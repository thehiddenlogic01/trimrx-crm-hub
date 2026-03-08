import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("manager"),
  permissions: text("permissions").default("[]"),
  featurePermissions: text("feature_permissions").default("{}"),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
});

export const cvReports = pgTable("cv_reports", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").default(""),
  status: text("status").default(""),
  link: text("link").default(""),
  duplicated: text("duplicated").default(""),
  customerEmail: text("customer_email").default(""),
  date: text("date").default(""),
  name: text("name").default(""),
  notesTrimrx: text("notes_trimrx").default(""),
  productType: text("product_type").default(""),
  clientThreat: text("client_threat").default(""),
  reason: text("reason").default(""),
  subReason: text("sub_reason").default(""),
  cancellationReason: text("cancellation_reason").default(""),
  desiredAction: text("desired_action").default(""),
  confidence: integer("confidence").default(0),
  checkingStatus: text("checking_status").default("Need Check"),
  submittedBy: text("submitted_by").default(""),
  assignedTo: text("assigned_to").default(""),
  sentToSheet: text("sent_to_sheet").default(""),
  slackStatusRt: text("slack_status_rt").default(""),
});

export const insertCvReportSchema = createInsertSchema(cvReports).omit({ id: true });
export type InsertCvReport = z.infer<typeof insertCvReportSchema>;
export type CvReport = typeof cvReports.$inferSelect;

export const caseFolders = pgTable("case_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const caseFiles = pgTable("case_files", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCaseFolderSchema = createInsertSchema(caseFolders).omit({ id: true, createdAt: true });
export type InsertCaseFolder = z.infer<typeof insertCaseFolderSchema>;
export type CaseFolder = typeof caseFolders.$inferSelect;

export const insertCaseFileSchema = createInsertSchema(caseFiles).omit({ id: true, createdAt: true });
export type InsertCaseFile = z.infer<typeof insertCaseFileSchema>;
export type CaseFile = typeof caseFiles.$inferSelect;

export const disputeReportsYedid = pgTable("dispute_reports_yedid", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").default(""),
  customerDescription: text("customer_description").default(""),
  customerEmail: text("customer_email").default(""),
  customerPhone: text("customer_phone").default(""),
  shippingName: text("shipping_name").default(""),
  shippingAddressLine1: text("shipping_address_line1").default(""),
  shippingAddressLine2: text("shipping_address_line2").default(""),
  shippingAddressCity: text("shipping_address_city").default(""),
  shippingAddressState: text("shipping_address_state").default(""),
  shippingAddressCountry: text("shipping_address_country").default(""),
  shippingAddressPostalCode: text("shipping_address_postal_code").default(""),
  disputedAmount: text("disputed_amount").default(""),
  disputeDate: text("dispute_date").default(""),
  disputeEvidenceDue: text("dispute_evidence_due").default(""),
  disputeReason: text("dispute_reason").default(""),
  disputeStatus: text("dispute_status").default(""),
  cancellationProcess: text("cancellation_process").default(""),
  invoiceId: text("invoice_id").default(""),
  rawData: text("raw_data").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDisputeReportYedidSchema = createInsertSchema(disputeReportsYedid).omit({ id: true, createdAt: true });
export type InsertDisputeReportYedid = z.infer<typeof insertDisputeReportYedidSchema>;
export type DisputeReportYedid = typeof disputeReportsYedid.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;

export * from "./models/chat";
