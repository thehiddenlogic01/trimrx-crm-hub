import type { Express, Request, Response } from "express";
import { storage } from "./storage";

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ message: "Not authenticated" });
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

export function setupAuditLogRoutes(app: Express) {
  app.get("/api/audit-logs", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

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

  app.get("/api/audit-logs/actions", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
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
