import { type User, type InsertUser, type CvReport, type InsertCvReport, type CaseFolder, type InsertCaseFolder, type CaseFile, type InsertCaseFile, type DisputeReportYedid, type InsertDisputeReportYedid, type AuditLog, type InsertAuditLog, users, appSettings, cvReports, caseFolders, caseFiles, disputeReportsYedid, auditLogs } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, count, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<{ role: string; permissions: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
  getCvReports(): Promise<CvReport[]>;
  getCvReport(id: number): Promise<CvReport | undefined>;
  createCvReport(report: InsertCvReport): Promise<CvReport>;
  updateCvReport(id: number, report: Partial<InsertCvReport>): Promise<CvReport | undefined>;
  deleteCvReport(id: number): Promise<void>;
  deleteAllCvReports(): Promise<void>;
  getCaseFolders(): Promise<CaseFolder[]>;
  getCaseFolder(id: number): Promise<CaseFolder | undefined>;
  createCaseFolder(folder: InsertCaseFolder): Promise<CaseFolder>;
  deleteCaseFolder(id: number): Promise<void>;
  getCaseFiles(folderId: number): Promise<CaseFile[]>;
  getCaseFile(id: number): Promise<CaseFile | undefined>;
  createCaseFile(file: InsertCaseFile): Promise<CaseFile>;
  deleteCaseFile(id: number): Promise<void>;
  updateCaseFolderStatus(id: number, status: string): Promise<CaseFolder | undefined>;
  getDisputeReportsYedid(): Promise<DisputeReportYedid[]>;
  createDisputeReportYedid(report: InsertDisputeReportYedid): Promise<DisputeReportYedid>;
  updateDisputeReportYedid(id: number, data: Partial<InsertDisputeReportYedid>): Promise<DisputeReportYedid | undefined>;
  deleteDisputeReportYedid(id: number): Promise<void>;
  deleteAllDisputeReportsYedid(): Promise<void>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters: { userId?: string; page?: string; action?: string; from?: Date; to?: Date; limit?: number; offset?: number }): Promise<{ logs: AuditLog[]; total: number }>;
  getAuditLogById(id: number): Promise<any | undefined>;
  deleteAuditLog(id: number): Promise<boolean>;
  deleteAuditLogsBulk(ids: number[]): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<{ role: string; permissions: string }>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(appSettings).where(eq(appSettings.key, key));
  }

  async getCvReports(): Promise<CvReport[]> {
    return db.select().from(cvReports).orderBy(desc(cvReports.id));
  }

  async getCvReport(id: number): Promise<CvReport | undefined> {
    const [report] = await db.select().from(cvReports).where(eq(cvReports.id, id));
    return report;
  }

  async createCvReport(report: InsertCvReport): Promise<CvReport> {
    const [created] = await db.insert(cvReports).values(report).returning();
    return created;
  }

  async updateCvReport(id: number, report: Partial<InsertCvReport>): Promise<CvReport | undefined> {
    const [updated] = await db.update(cvReports).set(report).where(eq(cvReports.id, id)).returning();
    return updated;
  }

  async deleteCvReport(id: number): Promise<void> {
    await db.delete(cvReports).where(eq(cvReports.id, id));
  }

  async deleteAllCvReports(): Promise<void> {
    await db.delete(cvReports);
  }

  async getCaseFolders(): Promise<CaseFolder[]> {
    return db.select().from(caseFolders).orderBy(desc(caseFolders.id));
  }

  async getCaseFolder(id: number): Promise<CaseFolder | undefined> {
    const [folder] = await db.select().from(caseFolders).where(eq(caseFolders.id, id));
    return folder;
  }

  async createCaseFolder(folder: InsertCaseFolder): Promise<CaseFolder> {
    const [created] = await db.insert(caseFolders).values(folder).returning();
    return created;
  }

  async deleteCaseFolder(id: number): Promise<void> {
    await db.delete(caseFiles).where(eq(caseFiles.folderId, id));
    await db.delete(caseFolders).where(eq(caseFolders.id, id));
  }

  async updateCaseFolderStatus(id: number, status: string): Promise<CaseFolder | undefined> {
    const [updated] = await db.update(caseFolders).set({ status }).where(eq(caseFolders.id, id)).returning();
    return updated;
  }

  async getCaseFiles(folderId: number): Promise<CaseFile[]> {
    return db.select().from(caseFiles).where(eq(caseFiles.folderId, folderId)).orderBy(desc(caseFiles.id));
  }

  async getCaseFile(id: number): Promise<CaseFile | undefined> {
    const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, id));
    return file;
  }

  async createCaseFile(file: InsertCaseFile): Promise<CaseFile> {
    const [created] = await db.insert(caseFiles).values(file).returning();
    return created;
  }

  async deleteCaseFile(id: number): Promise<void> {
    await db.delete(caseFiles).where(eq(caseFiles.id, id));
  }

  async getDisputeReportsYedid(): Promise<DisputeReportYedid[]> {
    return db.select().from(disputeReportsYedid).orderBy(desc(disputeReportsYedid.id));
  }

  async createDisputeReportYedid(report: InsertDisputeReportYedid): Promise<DisputeReportYedid> {
    const [created] = await db.insert(disputeReportsYedid).values(report).returning();
    return created;
  }

  async updateDisputeReportYedid(id: number, data: Partial<InsertDisputeReportYedid>): Promise<DisputeReportYedid | undefined> {
    const [updated] = await db.update(disputeReportsYedid).set(data).where(eq(disputeReportsYedid.id, id)).returning();
    return updated;
  }

  async deleteDisputeReportYedid(id: number): Promise<void> {
    await db.delete(disputeReportsYedid).where(eq(disputeReportsYedid.id, id));
  }

  async deleteAllDisputeReportsYedid(): Promise<void> {
    await db.delete(disputeReportsYedid);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(filters: { userId?: string; page?: string; action?: string; from?: Date; to?: Date; limit?: number; offset?: number }): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions = [];
    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters.page) conditions.push(eq(auditLogs.page, filters.page));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(auditLogs).where(where);
    const logs = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(filters.limit || 50).offset(filters.offset || 0);

    return { logs, total: totalResult?.count || 0 };
  }

  async getAuditLogById(id: number): Promise<any | undefined> {
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log;
  }

  async deleteAuditLog(id: number): Promise<boolean> {
    const existing = await this.getAuditLogById(id);
    if (!existing) return false;
    await db.delete(auditLogs).where(eq(auditLogs.id, id));
    return true;
  }

  async deleteAuditLogsBulk(ids: number[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      const existing = await this.getAuditLogById(id);
      if (existing) {
        await db.delete(auditLogs).where(eq(auditLogs.id, id));
        deleted++;
      }
    }
    return deleted;
  }
}

export const storage = new DatabaseStorage();
