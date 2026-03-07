import type { Express, Request, Response } from "express";
import { google } from "googleapis";
import { storage } from "./storage";
import { ALL_REASONS, ALL_SUB_REASONS, DESIRED_ACTION_OPTIONS, CLIENT_THREAT_OPTIONS } from "../shared/classification";

const GSHEET_SETTINGS_PREFIX = "gsheet_";

async function getGSheetConfig() {
  const credentials = await storage.getSetting(`${GSHEET_SETTINGS_PREFIX}credentials`);
  const spreadsheetId = await storage.getSetting(`${GSHEET_SETTINGS_PREFIX}spreadsheet_id`);
  const sheetName = await storage.getSetting(`${GSHEET_SETTINGS_PREFIX}sheet_name`);
  const columnMapping = await storage.getSetting(`${GSHEET_SETTINGS_PREFIX}column_mapping`);
  const startRow = await storage.getSetting(`${GSHEET_SETTINGS_PREFIX}start_row`);

  return {
    credentials: credentials || "",
    spreadsheetId: spreadsheetId || "",
    sheetName: sheetName || "Sheet1",
    columnMapping: columnMapping ? JSON.parse(columnMapping) : {},
    startRow: startRow ? parseInt(startRow) : 2,
  };
}

function getSheetsClient(credentialsJson: string) {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export function setupGSheetsRoutes(app: Express) {
  app.get("/api/gsheets/config", async (_req: Request, res: Response) => {
    try {
      const config = await getGSheetConfig();
      res.json({
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        columnMapping: config.columnMapping,
        startRow: config.startRow,
        hasCredentials: !!config.credentials,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gsheets/config", async (req: Request, res: Response) => {
    try {
      const { credentials, spreadsheetId, sheetName, columnMapping, startRow } = req.body;

      if (credentials !== undefined) {
        await storage.setSetting(`${GSHEET_SETTINGS_PREFIX}credentials`, credentials);
      }
      if (spreadsheetId !== undefined) {
        await storage.setSetting(`${GSHEET_SETTINGS_PREFIX}spreadsheet_id`, spreadsheetId);
      }
      if (sheetName !== undefined) {
        await storage.setSetting(`${GSHEET_SETTINGS_PREFIX}sheet_name`, sheetName);
      }
      if (columnMapping !== undefined) {
        await storage.setSetting(`${GSHEET_SETTINGS_PREFIX}column_mapping`, JSON.stringify(columnMapping));
      }
      if (startRow !== undefined) {
        await storage.setSetting(`${GSHEET_SETTINGS_PREFIX}start_row`, String(startRow));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gsheets/test", async (_req: Request, res: Response) => {
    try {
      const config = await getGSheetConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "Google Sheets credentials and Spreadsheet ID are required" });
      }

      const sheets = getSheetsClient(config.credentials);
      const response = await sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheetId,
      });

      const sheetNames = response.data.sheets?.map((s) => s.properties?.title) || [];

      res.json({
        success: true,
        title: response.data.properties?.title,
        sheets: sheetNames,
      });
    } catch (err: any) {
      res.status(400).json({ error: `Connection failed: ${err.message}` });
    }
  });

  app.post("/api/gsheets/push", async (req: Request, res: Response) => {
    try {
      const config = await getGSheetConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "Google Sheets is not configured" });
      }

      const { reportIds, sortOrder } = req.body;
      if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ error: "No report IDs provided" });
      }

      const mapping = config.columnMapping as Record<string, string>;
      if (Object.keys(mapping).length === 0) {
        return res.status(400).json({ error: "Column mapping is not configured" });
      }

      const allReports = await storage.getCvReports();
      const selectedReports = allReports
        .filter((r) => reportIds.includes(r.id))
        .sort((a, b) => sortOrder === "first-last" ? a.id - b.id : b.id - a.id);

      if (selectedReports.length === 0) {
        return res.status(400).json({ error: "No matching reports found" });
      }

      const sortedMappings = Object.entries(mapping)
        .sort((a, b) => columnLetterToIndex(a[1]) - columnLetterToIndex(b[1]));

      const maxColIndex = Math.max(...sortedMappings.map(([, col]) => columnLetterToIndex(col)));

      const rows = selectedReports.map((report) => {
        const row: (string | number)[] = new Array(maxColIndex + 1).fill("");
        for (const [field, col] of sortedMappings) {
          const idx = columnLetterToIndex(col);
          row[idx] = (report as any)[field] || "";
        }
        return row;
      });

      const sheets = getSheetsClient(config.credentials);

      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${config.sheetName}!A${config.startRow}`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: rows,
        },
      });

      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: config.spreadsheetId });
      const sheetObj = sheetMeta.data.sheets?.find((s) => s.properties?.title === config.sheetName);
      const sheetId = sheetObj?.properties?.sheetId ?? 0;

      const updatedRange = appendResult.data.updates?.updatedRange || "";
      const rangeMatch = updatedRange.match(/!([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (rangeMatch) {
        const startRowIdx = parseInt(rangeMatch[2]) - 1;
        const endRowIdx = parseInt(rangeMatch[4]);
        const endColIdx = maxColIndex + 1;

        const batchRequests: any[] = [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: startRowIdx,
                endRowIndex: endRowIdx,
                startColumnIndex: 0,
                endColumnIndex: endColIdx,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: "LEFT",
                  verticalAlignment: "MIDDLE",
                  wrapStrategy: "CLIP",
                  textFormat: { fontSize: 10 },
                },
              },
              fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy,textFormat.fontSize)",
            },
          },
        ];

        const dropdownFields: Record<string, string[]> = {
          reason: ALL_REASONS,
          subReason: ALL_SUB_REASONS,
          desiredAction: DESIRED_ACTION_OPTIONS,
          clientThreat: CLIENT_THREAT_OPTIONS,
          checkingStatus: ["Need Check", "Ready"],
        };

        for (const [field, options] of Object.entries(dropdownFields)) {
          const colLetter = mapping[field];
          if (!colLetter) continue;
          const colIdx = columnLetterToIndex(colLetter);

          batchRequests.push({
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: startRowIdx,
                endRowIndex: endRowIdx,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
              rule: {
                condition: {
                  type: "ONE_OF_LIST",
                  values: options.map((v) => ({ userEnteredValue: v })),
                },
                showCustomUi: true,
                strict: false,
              },
            },
          });
        }


        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: config.spreadsheetId,
          requestBody: { requests: batchRequests },
        });
      }

      res.json({ success: true, pushed: selectedReports.length });
    } catch (err: any) {
      res.status(500).json({ error: `Push failed: ${err.message}` });
    }
  });

  app.post("/api/gsheets/clear", async (req: Request, res: Response) => {
    try {
      const config = await getGSheetConfig();
      if (!config.credentials || !config.spreadsheetId) {
        return res.status(400).json({ error: "Google Sheets is not configured" });
      }

      const sheets = getSheetsClient(config.credentials);
      const range = `${config.sheetName}!A${config.startRow}:ZZ`;

      await sheets.spreadsheets.values.clear({
        spreadsheetId: config.spreadsheetId,
        range,
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: `Clear failed: ${err.message}` });
    }
  });

  app.post("/api/gsheets/disconnect", async (_req: Request, res: Response) => {
    try {
      await storage.deleteSetting(`${GSHEET_SETTINGS_PREFIX}credentials`);
      await storage.deleteSetting(`${GSHEET_SETTINGS_PREFIX}spreadsheet_id`);
      await storage.deleteSetting(`${GSHEET_SETTINGS_PREFIX}sheet_name`);
      await storage.deleteSetting(`${GSHEET_SETTINGS_PREFIX}column_mapping`);
      await storage.deleteSetting(`${GSHEET_SETTINGS_PREFIX}start_row`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.toUpperCase().charCodeAt(i) - 64);
  }
  return index - 1;
}
