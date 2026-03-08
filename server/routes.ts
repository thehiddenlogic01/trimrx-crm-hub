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
import { seedDefaultUser } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
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
  await seedDefaultUser();

  return httpServer;
}
