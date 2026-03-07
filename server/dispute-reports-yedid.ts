import type { Express } from "express";
import { storage } from "./storage";

const CSV_HEADER_MAP: Record<string, string> = {
  "Customer ID": "customerId",
  "Customer Description": "customerDescription",
  "Customer Email": "customerEmail",
  "Customer Phone": "customerPhone",
  "Shipping Name": "shippingName",
  "Shipping Address Line1": "shippingAddressLine1",
  "Shipping Address Line2": "shippingAddressLine2",
  "Shipping Address City": "shippingAddressCity",
  "Shipping Address State": "shippingAddressState",
  "Shipping Address Country": "shippingAddressCountry",
  "Shipping Address Postal Code": "shippingAddressPostalCode",
  "Disputed Amount": "disputedAmount",
  "Dispute Date (UTC)": "disputeDate",
  "Dispute Evidence Due (UTC)": "disputeEvidenceDue",
  "Dispute Reason": "disputeReason",
  "Dispute Status": "disputeStatus",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === "," || char === "\t") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function setupDisputeReportsYedidRoutes(app: Express) {
  app.get("/api/dispute-reports-yedid", async (_req, res) => {
    const reports = await storage.getDisputeReportsYedid();
    res.json(reports);
  });

  app.post("/api/dispute-reports-yedid/import", async (req, res) => {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    let imported = 0;
    for (const row of rows) {
      const mapped: Record<string, string> = {};
      for (const [csvHeader, dbField] of Object.entries(CSV_HEADER_MAP)) {
        mapped[dbField] = row[csvHeader] || "";
      }
      mapped.rawData = JSON.stringify(row);
      await storage.createDisputeReportYedid(mapped as any);
      imported++;
    }

    res.json({ imported });
  });

  app.post("/api/dispute-reports-yedid/parse-csv", async (req, res) => {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: "No CSV text provided" });

    const rows = parseCSV(csvText);
    res.json({ rows, count: rows.length });
  });

  app.patch("/api/dispute-reports-yedid/:id", async (req, res) => {
    const updated = await storage.updateDisputeReportYedid(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Report not found" });
    res.json(updated);
  });

  app.delete("/api/dispute-reports-yedid/:id", async (req, res) => {
    await storage.deleteDisputeReportYedid(Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete("/api/dispute-reports-yedid", async (_req, res) => {
    await storage.deleteAllDisputeReportsYedid();
    res.json({ ok: true });
  });
}
