import type { Express } from "express";
import { type Server } from "http";
import { setupAuth } from "./auth";
import { setupSlackRoutes } from "./slack";
import { setupCvReportRoutes } from "./cv-reports";
import { setupUserRoutes } from "./user-routes";
import { setupGSheetsRoutes } from "./gsheets";
import { setupCaseFolderRoutes } from "./case-folders";
import { setupDisputeReportsYedidRoutes } from "./dispute-reports-yedid";
import { setupDisputeSettingsRoutes } from "./dispute-settings";
import { setupCvSettingsRoutes } from "./cv-settings";
import { setupCareValidateRoutes } from "./carevalidate";
import { registerChatRoutes } from "./replit_integrations/chat";
import { setupPtFinderRoutes } from "./pt-finder";
import { registerStripePaymentRoutes } from "./stripe-payments";
import { setupAuditLogRoutes } from "./audit-logs";
import { setupAuditAlertRoutes } from "./audit-alerts";
import { seedDefaultUser } from "./seed";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.get("/api/app-settings/mention_notifications_enabled", async (_req, res) => {
    try {
      const val = await storage.getSetting("mention_notifications_enabled");
      res.json({ enabled: val !== "false" });
    } catch {
      res.json({ enabled: true });
    }
  });

  app.post("/api/app-settings/mention_notifications_enabled", async (req, res) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const { enabled } = req.body;
    await storage.setSetting("mention_notifications_enabled", enabled === false ? "false" : "true");
    res.json({ ok: true });
  });

  setupSlackRoutes(app);
  setupCvReportRoutes(app);
  setupUserRoutes(app);
  setupGSheetsRoutes(app);
  setupCaseFolderRoutes(app);
  setupDisputeReportsYedidRoutes(app);
  setupDisputeSettingsRoutes(app);
  setupCvSettingsRoutes(app);
  setupCareValidateRoutes(app);
  registerChatRoutes(app);
  setupPtFinderRoutes(app);
  registerStripePaymentRoutes(app);
  setupAuditLogRoutes(app);
  setupAuditAlertRoutes(app);
  await seedDefaultUser();

  return httpServer;
}
