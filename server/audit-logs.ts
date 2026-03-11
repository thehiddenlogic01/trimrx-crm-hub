import type { Express, Request, Response } from "express";
import { WebClient } from "@slack/web-api";
import { storage } from "./storage";
import { z } from "zod";

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }
  if ((req.user as any).role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
}

export function logAudit(req: Request, action: string, page: string, details?: string) {
  try {
    const user = req.user as any;
    if (!user) return;
    storage.createAuditLog({
      userId: user.id,
      username: user.username,
      action,
      page,
      details: details || "",
    }).catch(() => {});
  } catch {}
}

function parseSlackDetails(details: string): { ts: string; channelId: string; storedText: string; replyText: string } | null {
  const firstLine = details.split("\n---MSG---\n")[0];
  const msgMatch = firstLine.match(/(?:Message|Thread):\s*([\d.]+),\s*Channel:\s*(\S+)/);
  if (!msgMatch) return null;
  const storedText = details.includes("\n---MSG---\n") ? details.split("\n---MSG---\n")[1] : "";
  const replyMatch = firstLine.match(/Reply:\s*(.+)$/);
  return { ts: msgMatch[1], channelId: msgMatch[2].replace(/,.*$/, ""), storedText, replyText: replyMatch?.[1] || "" };
}

function parseCvReportId(details: string): number | null {
  const idMatch = details.match(/Report ID:\s*(\d+)/);
  if (idMatch) return parseInt(idMatch[1]);
  return null;
}

export function setupAuditLogRoutes(app: Express) {
  app.get("/api/audit-logs", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const { userId, page, action, from, to, limit, offset } = req.query;
      const result = await storage.getAuditLogs({
        userId: userId as string | undefined,
        page: page as string | undefined,
        action: action as string | undefined,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/:id/context", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const log = await storage.getAuditLogById(id);
      if (!log) return res.status(404).json({ message: "Audit log not found" });

      if (log.page === "Manage Slack Case") {
        const parsed = parseSlackDetails(log.details || "");
        if (!parsed) return res.json({ type: "slack", data: null, message: "Could not parse message details" });

        if (parsed.storedText) {
          return res.json({
            type: "slack",
            data: {
              text: parsed.storedText,
              ts: parsed.ts,
              channelId: parsed.channelId,
              replyText: parsed.replyText || undefined,
            },
          });
        }

        try {
          const botToken = await storage.getSetting("slack_bot_token");
          if (botToken) {
            const client = new WebClient(botToken);
            const result = await client.conversations.history({
              channel: parsed.channelId,
              latest: parsed.ts,
              inclusive: true,
              limit: 1,
            });
            if (result.messages && result.messages.length > 0) {
              const msg = result.messages[0];
              return res.json({ type: "slack", data: { text: msg.text || "", user: msg.user || "", ts: msg.ts, channelId: parsed.channelId } });
            }
          }
        } catch {}

        return res.json({ type: "slack", data: null, ts: parsed.ts, channelId: parsed.channelId, message: "Message not available (may have been deleted)" });
      }

      if (log.page === "CV Report") {
        const reportId = parseCvReportId(log.details || "");
        if (reportId) {
          const report = await storage.getCvReport(reportId);
          if (report) return res.json({ type: "cv-report", data: report });
          return res.json({ type: "cv-report", data: null, message: "Report not found (may have been deleted)" });
        }

        const caseMatch = log.details?.match(/Case:\s*([^,]+)/);
        const emailMatch = log.details?.match(/Email:\s*(\S+)/);
        if (caseMatch || emailMatch) {
          const allReports = await storage.getCvReports();
          const found = allReports.find(r =>
            (caseMatch && r.caseId === caseMatch[1].trim()) ||
            (emailMatch && r.customerEmail === emailMatch[1].trim())
          );
          if (found) return res.json({ type: "cv-report", data: found });
          return res.json({ type: "cv-report", data: null, caseId: caseMatch?.[1]?.trim(), email: emailMatch?.[1]?.trim(), message: "Report not found" });
        }

        return res.json({ type: "cv-report", data: null, message: "Could not parse report details" });
      }

      if (log.page === "Retention Final Submit") {
        return res.json({ type: "retention", data: null, message: log.details || "Push to Google Sheets action" });
      }

      return res.json({ type: "unknown", data: null, message: log.details || "No context available" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch context" });
    }
  });

  app.delete("/api/audit-logs/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const deleted = await storage.deleteAuditLog(id);
      if (!deleted) return res.status(404).json({ message: "Audit log not found" });
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete audit log" });
    }
  });

  app.post("/api/audit-logs/delete-bulk", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
      const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1) }).parse(req.body);
      const deleted = await storage.deleteAuditLogsBulk(parsed.ids);
      return res.json({ ok: true, deleted });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to delete audit logs" });
    }
  });

  app.get("/api/audit-logs/actions", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json([
      "Reply Sent",
      "Mark as Done",
      "Unmark Done",
      "Delete Message",
      "CV Report Created",
      "CV Report Updated",
      "CV Report Deleted",
      "Push to Google Sheets",
    ]);
  });
}
