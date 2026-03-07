import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import { storage } from "./storage";

const PT_FINDER_PREFIX = "pt_finder_";

async function getPtFinderConfig() {
  const credentials = await storage.getSetting(`${PT_FINDER_PREFIX}credentials`);
  const spreadsheetId = await storage.getSetting(`${PT_FINDER_PREFIX}spreadsheet_id`);
  const sheetName = await storage.getSetting(`${PT_FINDER_PREFIX}sheet_name`);
  const headerRow = await storage.getSetting(`${PT_FINDER_PREFIX}header_row`);

  return {
    credentials: credentials || "",
    spreadsheetId: spreadsheetId || "",
    sheetName: sheetName || "Sheet1",
    headerRow: headerRow ? parseInt(headerRow) : 1,
  };
}

function getSheetsClient(credentialsJson: string) {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

export function setupPtFinderRoutes(app: Express) {
  app.get("/api/pt-finder/config", async (_req: Request, res: Response) => {
    try {
      const config = await getPtFinderConfig();
      res.json({
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        headerRow: config.headerRow,
        hasCredentials: !!config.credentials,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pt-finder/config", async (req: Request, res: Response) => {
    try {
      const { credentials, spreadsheetId, sheetName, headerRow } = req.body;

      if (credentials !== undefined) {
        await storage.setSetting(`${PT_FINDER_PREFIX}credentials`, credentials);
      }
      if (spreadsheetId !== undefined) {
        await storage.setSetting(`${PT_FINDER_PREFIX}spreadsheet_id`, spreadsheetId);
      }
      if (sheetName !== undefined) {
        await storage.setSetting(`${PT_FINDER_PREFIX}sheet_name`, sheetName);
      }
      if (headerRow !== undefined) {
        await storage.setSetting(`${PT_FINDER_PREFIX}header_row`, String(headerRow));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pt-finder/test", async (_req: Request, res: Response) => {
    try {
      const config = await getPtFinderConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "Credentials and Spreadsheet ID are required" });
      }

      const sheets = getSheetsClient(config.credentials);
      const range = `${config.sheetName}!${config.headerRow}:${config.headerRow}`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range,
      });

      const headers = response.data.values?.[0] || [];
      res.json({ success: true, headers, sheetName: config.sheetName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pt-finder/disconnect", async (_req: Request, res: Response) => {
    try {
      await storage.setSetting(`${PT_FINDER_PREFIX}credentials`, "");
      await storage.setSetting(`${PT_FINDER_PREFIX}spreadsheet_id`, "");
      await storage.setSetting(`${PT_FINDER_PREFIX}sheet_name`, "Sheet1");
      await storage.setSetting(`${PT_FINDER_PREFIX}header_row`, "1");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pt-finder/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query?.trim()) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const config = await getPtFinderConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "PT Finder is not configured. Go to Settings to connect a Google Sheet." });
      }

      const sheets = getSheetsClient(config.credentials);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: config.sheetName,
      });

      const allRows = response.data.values || [];
      if (allRows.length < config.headerRow) {
        return res.json({ results: [], headers: [] });
      }

      const headers = allRows[config.headerRow - 1] || [];
      const dataRows = allRows.slice(config.headerRow);

      const searchTerms = query.toLowerCase().trim().split(/\s+/);
      const matches = dataRows.filter((row: string[]) => {
        const rowText = row.join(" ").toLowerCase();
        return searchTerms.every((term: string) => rowText.includes(term));
      });

      const results = matches.map((row: string[]) => {
        const record: Record<string, string> = {};
        headers.forEach((header: string, idx: number) => {
          record[header] = row[idx] || "";
        });
        return record;
      });

      res.json({ results, headers, totalRows: dataRows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pt-finder/batch-search", async (req: Request, res: Response) => {
    try {
      const { queries } = req.body;
      if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: "Queries array is required" });
      }

      const config = await getPtFinderConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "PT Finder is not configured" });
      }

      const sheets = getSheetsClient(config.credentials);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: config.sheetName,
      });

      const allRows = response.data.values || [];
      if (allRows.length < config.headerRow) {
        return res.json({ results: {} });
      }

      const headers = allRows[config.headerRow - 1] || [];
      const dataRows = allRows.slice(config.headerRow);

      const results: Record<string, Record<string, string> | null> = {};
      for (const q of queries) {
        const qLower = String(q).toLowerCase().trim();
        if (!qLower) {
          results[q] = null;
          continue;
        }
        const match = dataRows.find((row: string[]) => {
          const rowText = row.join(" ").toLowerCase();
          return rowText.includes(qLower);
        });
        if (match) {
          const record: Record<string, string> = {};
          headers.forEach((header: string, idx: number) => {
            record[header] = match[idx] || "";
          });
          results[q] = record;
        } else {
          results[q] = null;
        }
      }

      res.json({ results, headers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
