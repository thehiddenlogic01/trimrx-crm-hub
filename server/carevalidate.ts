import { type Express } from "express";
import { storage } from "./storage";

const progressStore: Record<string, { current: number; total: number; stage: string }> = {};

export { progressStore as carevalidateProgressStore };

const CAREVALIDATE_GRAPHQL_URL = process.env.CAREVALIDATE_GRAPHQL_URL || "https://api.care360-next.carevalidate.com/graphql/";

const CASE_BY_ID_QUERY = `query CaseByIdQuery($caseId: String) {
  caseById(caseId: $caseId) {
    id
    shortId
    status
    type
    title
    closedAt
    isArchived
    archiveReason
    archiveNote
    productBundle {
      name
    }
    submitter {
      firstName
      lastName
      fullName
      email
      phoneNumber
    }
  }
}`;

const CASE_TREATMENTS_QUERY = `query CaseTreatmentsQuery($caseId: String!) {
  caseTreatments(caseId: $caseId) {
    id
    status
    organizationProduct {
      id
      name
    }
  }
}`;


function buildDetailedStatus(caseData: any): string {
  const status = caseData.status || "";
  const isArchived = caseData.isArchived || false;
  const archiveReason = caseData.archiveReason || "";
  const archiveNote = caseData.archiveNote || "";

  if (isArchived) {
    const reasonMap: Record<string, string> = {
      "INELIGIBLE": "Closed",
      "APPROVED": "Approved",
      "DENIED": "Denied",
      "RESOLVED": "Resolved",
    };
    const base = reasonMap[archiveReason] || "Closed";
    if (archiveNote) {
      return `${base} (${archiveNote})`;
    }
    return base;
  }
  
  const statusMap: Record<string, string> = {
    "APPROVED": "Approved",
    "IN_PROGRESS": "In Progress",
    "SUBMITTED": "Submitted",
    "CLOSED": "Closed",
    "DENIED": "Denied",
    "COMPLETED": "Completed",
    "PENDING": "Pending",
    "NO_DECISION": "No Decision",
  };
  
  return statusMap[status] || status;
}

function mapProductBundle(productBundle: string | null | undefined): string {
  if (!productBundle) return "";
  const lower = productBundle.toLowerCase();
  if (lower.includes("12 month") || lower.includes("12-month") || lower.includes("12month") || /\b12\s*m\b/.test(lower) || lower.includes("12 mo")) return "12M Bundle";
  if (lower.includes("6 month") || lower.includes("6-month") || lower.includes("6month") || /\b6\s*m\b/.test(lower) || lower.includes("6 mo")) return "6M Bundle";
  if (lower.includes("3 month") || lower.includes("3-month") || lower.includes("3month") || /\b3\s*m\b/.test(lower) || lower.includes("3 mo")) return "3M Bundle";
  if (lower.includes("1 month") || lower.includes("1-month") || lower.includes("1month") || /\b1\s*m\b/.test(lower) || lower.includes("monthly") || lower.includes("1 mo")) return "1M";
  if (lower.includes("supplement")) return "Supplement";
  if (lower.includes("upsell")) return "Upsell";
  return "";
}

function extractProductType(caseData: any): string {
  if (caseData.productBundle?.name) {
    const mapped = mapProductBundle(caseData.productBundle.name);
    if (mapped) return mapped;
  }

  if (caseData._treatmentProductName) {
    const mapped = mapProductBundle(caseData._treatmentProductName);
    if (mapped) return mapped;
  }

  const titleMapped = mapProductBundle(caseData.title);
  if (titleMapped) return titleMapped;

  return "";
}

async function fetchTreatmentProductName(caseUUID: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(CAREVALIDATE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        operationName: "CaseTreatmentsQuery",
        query: CASE_TREATMENTS_QUERY,
        variables: { caseId: caseUUID },
      }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (json.errors?.length) return null;

    const treatments = json.data?.caseTreatments;
    if (!Array.isArray(treatments) || treatments.length === 0) return null;

    for (const t of treatments) {
      const name = t.organizationProduct?.name;
      if (name) {
        console.log(`[carevalidate] Treatment product found: "${name}"`);
        return name;
      }
    }

    return null;
  } catch (err) {
    console.error("[carevalidate] Treatment fetch error:", err);
    return null;
  }
}

function extractCaseUUID(link: string): string | null {
  const match = link.match(/\/cases\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

async function fetchCaseData(caseUUID: string, token: string) {
  const res = await fetch(CAREVALIDATE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: "CaseByIdQuery",
      query: CASE_BY_ID_QUERY,
      variables: { caseId: caseUUID },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[carevalidate] API error ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`CareValidate API returned ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    console.error(`[carevalidate] GraphQL errors:`, JSON.stringify(json.errors));
    throw new Error(json.errors[0].message || "GraphQL error");
  }

  const caseData = json.data?.caseById || null;
  if (caseData) {
    const { submitter, ...rest } = caseData;
    console.log(`[carevalidate] Case ${caseData.shortId}:`, JSON.stringify(rest));

    if (!caseData.productBundle?.name) {
      console.log(`[carevalidate] productBundle null for ${caseData.shortId}, trying caseTreatments...`);
      const treatmentName = await fetchTreatmentProductName(caseUUID, token);
      if (treatmentName) {
        caseData._treatmentProductName = treatmentName;
        console.log(`[carevalidate] Method 2 success: "${treatmentName}" for ${caseData.shortId}`);
      }
    }
  }

  return caseData;
}

export function setupCareValidateRoutes(app: Express) {
  app.get("/api/carevalidate/token-status", async (_req, res) => {
    try {
      const token = await storage.getSetting("carevalidate_token");
      res.json({ hasToken: !!token && token.length > 10 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/carevalidate/token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token?.trim()) {
        return res.status(400).json({ message: "Token is required" });
      }
      const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
      await storage.setSetting("carevalidate_token", cleanToken);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/carevalidate/token", async (req, res) => {
    try {
      await storage.setSetting("carevalidate_token", "");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/carevalidate/fetch-case/:reportId", async (req, res) => {
    try {
      const reportId = parseInt(req.params.reportId);
      if (isNaN(reportId)) return res.status(400).json({ message: "Invalid report ID" });

      const token = await storage.getSetting("carevalidate_token");
      if (!token) return res.status(400).json({ message: "CareValidate token not configured. Please set it first." });

      const report = await storage.getCvReport(reportId);
      if (!report) return res.status(404).json({ message: "Report not found" });
      if (!report.link) return res.status(400).json({ message: "Report has no link" });

      const caseUUID = extractCaseUUID(report.link);
      if (!caseUUID) return res.status(400).json({ message: "Could not extract case UUID from link" });

      const caseData = await fetchCaseData(caseUUID, token);
      if (!caseData) return res.status(404).json({ message: "Case not found in CareValidate" });

      const updates: Record<string, string> = {};
      const submitter = caseData.submitter;
      if (submitter) {
        if (submitter.fullName && !report.name) updates.name = submitter.fullName;
        if (submitter.email && !report.customerEmail) updates.customerEmail = submitter.email;
      }
      if (caseData.shortId && (!report.caseId || report.caseId === "ID")) {
        updates.caseId = caseData.shortId;
      }
      const detailedStatus = buildDetailedStatus(caseData);
      if (detailedStatus && !report.status) {
        updates.status = detailedStatus;
      }
      const productType = extractProductType(caseData);
      if (productType && !report.productType) {
        updates.productType = productType;
      }

      if (Object.keys(updates).length > 0) {
        const updated = await storage.updateCvReport(reportId, updates);
        return res.json({ updated: true, fields: Object.keys(updates), report: updated });
      }

      return res.json({ updated: false, message: "All fields already populated", report });
    } catch (err: any) {
      console.error("CareValidate fetch error:", err.message);
      res.status(500).json({ message: err.message || "Failed to fetch case data" });
    }
  });

  app.post("/api/carevalidate/fetch-all", async (_req, res) => {
    const taskId = "fetch-case-data";
    try {
      const token = await storage.getSetting("carevalidate_token");
      if (!token) return res.status(400).json({ message: "CareValidate token not configured" });

      const reports = await storage.getCvReports();
      const results: { id: number; status: string; fields?: string[] }[] = [];
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      progressStore[taskId] = { current: 0, total: reports.length, stage: "Starting..." };

      for (let idx = 0; idx < reports.length; idx++) {
        const report = reports[idx];
        progressStore[taskId] = { current: idx + 1, total: reports.length, stage: `Fetching case ${idx + 1}/${reports.length}...` };
        if (!report.link) {
          results.push({ id: report.id, status: "skipped_no_link" });
          skipCount++;
          continue;
        }

        const caseUUID = extractCaseUUID(report.link);
        if (!caseUUID) {
          results.push({ id: report.id, status: "skipped_bad_link" });
          skipCount++;
          continue;
        }

        const needsName = !report.name;
        const needsEmail = !report.customerEmail;
        const needsCaseId = !report.caseId || report.caseId === "ID";
        const needsStatus = !report.status;
        const needsProductType = !report.productType;

        if (!needsName && !needsEmail && !needsCaseId && !needsStatus && !needsProductType) {
          results.push({ id: report.id, status: "skipped_complete" });
          skipCount++;
          continue;
        }

        try {
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

          const caseData = await fetchCaseData(caseUUID, token);
          if (!caseData) {
            results.push({ id: report.id, status: "not_found" });
            errorCount++;
            continue;
          }

          const updates: Record<string, string> = {};
          const submitter = caseData.submitter;
          if (submitter) {
            if (submitter.fullName && needsName) updates.name = submitter.fullName;
            if (submitter.email && needsEmail) updates.customerEmail = submitter.email;
          }
          if (caseData.shortId && needsCaseId) updates.caseId = caseData.shortId;
          const detailedSt = buildDetailedStatus(caseData);
          if (detailedSt && needsStatus) updates.status = detailedSt;
          const prodType = extractProductType(caseData);
          if (prodType && needsProductType) updates.productType = prodType;

          if (Object.keys(updates).length > 0) {
            await storage.updateCvReport(report.id, updates);
            results.push({ id: report.id, status: "updated", fields: Object.keys(updates) });
            successCount++;
          } else {
            results.push({ id: report.id, status: "no_data" });
            skipCount++;
          }
        } catch (err: any) {
          results.push({ id: report.id, status: `error: ${err.message}` });
          errorCount++;
          if (err.message?.includes("401") || err.message?.includes("403")) {
            delete progressStore[taskId];
            return res.status(401).json({
              message: "Token expired or invalid. Please update your CareValidate token.",
              results,
              successCount,
              skipCount,
              errorCount,
            });
          }
        }
      }

      delete progressStore[taskId];
      res.json({ results, successCount, skipCount, errorCount, total: reports.length });
    } catch (err: any) {
      delete progressStore[taskId];
      console.error("CareValidate fetch-all error:", err.message);
      res.status(500).json({ message: err.message || "Failed to fetch case data" });
    }
  });

  app.post("/api/carevalidate/lookup-case", async (req, res) => {
    try {
      const { link } = req.body;
      if (!link) return res.status(400).json({ message: "Link is required" });

      const token = await storage.getSetting("carevalidate_token");
      if (!token) return res.status(400).json({ message: "CareValidate token not configured" });

      const caseUUID = extractCaseUUID(link);
      if (!caseUUID) return res.status(400).json({ message: "Could not extract case UUID from link" });

      const caseData = await fetchCaseData(caseUUID, token);
      if (!caseData) return res.json({ found: false, message: "Case not found" });

      const submitter = caseData.submitter;
      const name = submitter?.fullName || [submitter?.firstName, submitter?.lastName].filter(Boolean).join(" ") || "";
      const email = submitter?.email || "";
      const status = buildDetailedStatus(caseData);

      res.json({ found: true, name, email, status, caseId: caseData.shortId || "" });
    } catch (err: any) {
      console.error("[carevalidate] lookup-case error:", err.message);
      if (err.message?.includes("401") || err.message?.includes("403")) {
        return res.status(401).json({ message: "Token expired or invalid" });
      }
      res.status(500).json({ message: err.message || "Failed to look up case" });
    }
  });
}
