import type { Express, Request, Response } from "express";
import { storage } from "./storage";

const ALERT_PREFIX = "audit_alert_";

interface AlertConfig {
  enabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  intervalMinutes: number;
  filterUsers: string[];
  filterPages: string[];
  filterActions: string[];
}

async function getAlertConfig(): Promise<AlertConfig> {
  const enabled = await storage.getSetting(`${ALERT_PREFIX}enabled`);
  const telegramBotToken = await storage.getSetting(`${ALERT_PREFIX}telegram_bot_token`);
  const telegramChatId = await storage.getSetting(`${ALERT_PREFIX}telegram_chat_id`);
  const intervalMinutes = await storage.getSetting(`${ALERT_PREFIX}interval_minutes`);
  const filterUsers = await storage.getSetting(`${ALERT_PREFIX}filter_users`);
  const filterPages = await storage.getSetting(`${ALERT_PREFIX}filter_pages`);
  const filterActions = await storage.getSetting(`${ALERT_PREFIX}filter_actions`);

  return {
    enabled: enabled === "true",
    telegramBotToken: telegramBotToken || "",
    telegramChatId: telegramChatId || "",
    intervalMinutes: intervalMinutes ? parseInt(intervalMinutes) : 60,
    filterUsers: filterUsers ? JSON.parse(filterUsers) : [],
    filterPages: filterPages ? JSON.parse(filterPages) : [],
    filterActions: filterActions ? JSON.parse(filterActions) : [],
  };
}

async function saveAlertConfig(config: Partial<AlertConfig>) {
  if (config.enabled !== undefined) await storage.setSetting(`${ALERT_PREFIX}enabled`, String(config.enabled));
  if (config.telegramBotToken !== undefined) await storage.setSetting(`${ALERT_PREFIX}telegram_bot_token`, config.telegramBotToken);
  if (config.telegramChatId !== undefined) await storage.setSetting(`${ALERT_PREFIX}telegram_chat_id`, config.telegramChatId);
  if (config.intervalMinutes !== undefined) await storage.setSetting(`${ALERT_PREFIX}interval_minutes`, String(config.intervalMinutes));
  if (config.filterUsers !== undefined) await storage.setSetting(`${ALERT_PREFIX}filter_users`, JSON.stringify(config.filterUsers));
  if (config.filterPages !== undefined) await storage.setSetting(`${ALERT_PREFIX}filter_pages`, JSON.stringify(config.filterPages));
  if (config.filterActions !== undefined) await storage.setSetting(`${ALERT_PREFIX}filter_actions`, JSON.stringify(config.filterActions));
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json() as any;
    if (!data.ok) return { ok: false, error: data.description || "Telegram API error" };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to send message" };
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAlertMessage(logs: any[], config: AlertConfig): string {
  if (logs.length === 0) return "";

  const userActions: Record<string, { pages: Set<string>; count: number; actions: string[] }> = {};

  for (const log of logs) {
    if (!userActions[log.username]) {
      userActions[log.username] = { pages: new Set(), count: 0, actions: [] };
    }
    userActions[log.username].pages.add(log.page);
    userActions[log.username].count++;
    if (userActions[log.username].actions.length < 5) {
      userActions[log.username].actions.push(`${log.action} (${log.page})`);
    }
  }

  let msg = `<b>📋 TrimRX Audit Alert</b>\n`;
  msg += `<i>${logs.length} action${logs.length !== 1 ? "s" : ""} recorded</i>\n\n`;

  for (const [username, data] of Object.entries(userActions)) {
    const pages = Array.from(data.pages).map(escapeHtml).join(", ");
    msg += `<b>👤 ${escapeHtml(username)}</b> — ${data.count} action${data.count !== 1 ? "s" : ""}\n`;
    msg += `Pages: ${pages}\n`;
    for (const action of data.actions) {
      msg += `  • ${escapeHtml(action)}\n`;
    }
    if (data.count > 5) {
      msg += `  <i>...and ${data.count - 5} more</i>\n`;
    }
    msg += `\n`;
  }

  const now = new Date();
  msg += `<i>Report time: ${now.toLocaleString("en-US", { timeZone: "America/Guatemala", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} GT</i>`;

  return msg;
}

async function getFilteredLogs(since: Date, config: AlertConfig, until?: Date) {
  const result = await storage.getAuditLogs({
    from: since,
    to: until || new Date(),
    limit: 500,
    offset: 0,
  });

  let logs = result.logs || [];

  if (config.filterUsers.length > 0) {
    logs = logs.filter((l: any) => config.filterUsers.includes(l.username));
  }
  if (config.filterPages.length > 0) {
    logs = logs.filter((l: any) => config.filterPages.some((p: string) => l.page.includes(p)));
  }
  if (config.filterActions.length > 0) {
    logs = logs.filter((l: any) => config.filterActions.includes(l.action));
  }

  return logs;
}

let scheduledInterval: ReturnType<typeof setInterval> | null = null;

async function runScheduledAlert() {
  try {
    const config = await getAlertConfig();
    if (!config.enabled || !config.telegramBotToken || !config.telegramChatId) return;

    const lastSent = await storage.getSetting(`${ALERT_PREFIX}last_sent`);
    const since = lastSent ? new Date(lastSent) : new Date(Date.now() - config.intervalMinutes * 60 * 1000);

    const logs = await getFilteredLogs(since, config);
    if (logs.length === 0) return;

    const message = buildAlertMessage(logs, config);
    if (!message) return;

    const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
    if (result.ok) {
      await storage.setSetting(`${ALERT_PREFIX}last_sent`, new Date().toISOString());
    }
  } catch {}
}

function startScheduler(intervalMinutes: number) {
  stopScheduler();
  if (intervalMinutes <= 0) return;
  scheduledInterval = setInterval(runScheduledAlert, intervalMinutes * 60 * 1000);
}

function stopScheduler() {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
  }
}

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

export function setupAuditAlertRoutes(app: Express) {
  app.get("/api/audit-alerts/config", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const config = await getAlertConfig();
      res.json({
        enabled: config.enabled,
        hasBotToken: !!config.telegramBotToken,
        telegramChatId: config.telegramChatId,
        intervalMinutes: config.intervalMinutes,
        filterUsers: config.filterUsers,
        filterPages: config.filterPages,
        filterActions: config.filterActions,
        lastSent: await storage.getSetting(`${ALERT_PREFIX}last_sent`) || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/audit-alerts/config", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { enabled, telegramBotToken, telegramChatId, intervalMinutes, filterUsers, filterPages, filterActions } = req.body;
      await saveAlertConfig({ enabled, telegramBotToken, telegramChatId, intervalMinutes, filterUsers, filterPages, filterActions });

      const config = await getAlertConfig();
      if (config.enabled && config.telegramBotToken && config.telegramChatId) {
        startScheduler(config.intervalMinutes);
      } else {
        stopScheduler();
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/audit-alerts/test", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const config = await getAlertConfig();
      if (!config.telegramBotToken || !config.telegramChatId) {
        return res.status(400).json({ error: "Telegram Bot Token and Chat ID are required" });
      }

      const result = await sendTelegramMessage(
        config.telegramBotToken,
        config.telegramChatId,
        "<b>✅ TrimRX Audit Alert Test</b>\n\nThis is a test message. Your alert configuration is working correctly!"
      );

      if (result.ok) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.error || "Failed to send test message" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/audit-alerts/send-now", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const config = await getAlertConfig();
      if (!config.telegramBotToken || !config.telegramChatId) {
        return res.status(400).json({ error: "Telegram Bot Token and Chat ID are required" });
      }

      const { sinceMinutes, fromTime, toTime } = req.body;
      let since: Date;
      let until: Date | undefined;

      if (fromTime) {
        since = new Date(fromTime);
        until = toTime ? new Date(toTime) : new Date();
      } else {
        const mins = sinceMinutes ? parseInt(sinceMinutes) : config.intervalMinutes;
        since = new Date(Date.now() - mins * 60 * 1000);
      }

      const logs = await getFilteredLogs(since, config, until);
      if (logs.length === 0) {
        return res.json({ success: true, sent: false, message: "No audit logs found for the selected period" });
      }

      const message = buildAlertMessage(logs, config);
      const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);

      if (result.ok) {
        await storage.setSetting(`${ALERT_PREFIX}last_sent`, new Date().toISOString());
        res.json({ success: true, sent: true, logCount: logs.length });
      } else {
        res.status(400).json({ error: result.error || "Failed to send alert" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/audit-alerts/send-custom", async (req: Request, res: Response) => {
    if (!req.isAuthenticated?.() || !req.user) return res.status(401).json({ error: "Not authenticated" });
    try {
      const config = await getAlertConfig();
      if (!config.telegramBotToken || !config.telegramChatId) {
        return res.status(400).json({ error: "Telegram bot is not configured. Ask an admin to set it up in Alerts settings." });
      }

      const { message, slackContext } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message cannot be empty" });
      }

      const username = (req.user as any).username || "Unknown";
      const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

      let text = `🚨 <b>HELP REQUEST</b>\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `👤 <b>Requested by:</b> ${escapeHtml(username)}\n`;
      text += `🕐 <b>Time:</b> ${now} ET\n\n`;
      text += `💬 <b>Note:</b>\n`;
      text += `<blockquote>${escapeHtml(message.trim())}</blockquote>\n`;

      if (slackContext) {
        text += `\n📋 <b>CASE DETAILS</b>\n`;
        text += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
        if (slackContext.user) text += `👨‍💼 <b>Agent:</b> ${escapeHtml(slackContext.user)}\n`;
        if (slackContext.caseId) text += `🆔 <b>Case ID:</b> <code>${escapeHtml(slackContext.caseId)}</code>\n`;
        if (slackContext.caseLink) text += `🔗 <b>Link:</b> <a href="${escapeHtml(slackContext.caseLink)}">Open Case</a>\n`;
        if (slackContext.messagePreview) {
          text += `\n📄 <b>Original Message:</b>\n`;
          text += `<blockquote>${escapeHtml(slackContext.messagePreview)}</blockquote>\n`;
        }
      }

      text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `<i>via TrimRX CRM</i>`;

      const result = await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, text);

      if (result.ok) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.error || "Failed to send message" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  (async () => {
    try {
      const config = await getAlertConfig();
      if (config.enabled && config.telegramBotToken && config.telegramChatId) {
        startScheduler(config.intervalMinutes);
      }
    } catch {}
  })();
}
