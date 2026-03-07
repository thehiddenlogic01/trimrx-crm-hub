import type { Express } from "express";
import { storage } from "./storage";
// @ts-ignore
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function setupCaseFolderRoutes(app: Express) {
  app.get("/api/case-folders", async (_req, res) => {
    const folders = await storage.getCaseFolders();
    res.json(folders);
  });

  app.get("/api/case-folders/:id", async (req, res) => {
    const folder = await storage.getCaseFolder(Number(req.params.id));
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(folder);
  });

  app.post("/api/case-folders", async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
    const folder = await storage.createCaseFolder({ name, email });
    res.status(201).json(folder);
  });

  app.patch("/api/case-folders/:id/status", async (req, res) => {
    const { status } = req.body;
    if (!status || !["pending", "ready"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'pending' or 'ready'" });
    }
    const updated = await storage.updateCaseFolderStatus(Number(req.params.id), status);
    if (!updated) return res.status(404).json({ error: "Folder not found" });
    res.json(updated);
  });

  app.delete("/api/case-folders/:id", async (req, res) => {
    await storage.deleteCaseFolder(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/case-folders/:id/files", async (req, res) => {
    const files = await storage.getCaseFiles(Number(req.params.id));
    const filesWithoutData = files.map(({ fileData, ...rest }) => rest);
    res.json(filesWithoutData);
  });

  app.post("/api/case-folders/:id/files", upload.single("file"), async (req, res) => {
    const folderId = Number(req.params.id);
    const folder = await storage.getCaseFolder(folderId);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const fileData = file.buffer.toString("base64");
    const created = await storage.createCaseFile({
      folderId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileData,
    });

    const { fileData: _, ...rest } = created;
    res.status(201).json(rest);
  });

  app.get("/api/case-files/:id/download", async (req, res) => {
    const file = await storage.getCaseFile(Number(req.params.id));
    if (!file) return res.status(404).json({ error: "File not found" });

    const buffer = Buffer.from(file.fileData, "base64");
    res.setHeader("Content-Type", file.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  });

  app.delete("/api/case-files/:id", async (req, res) => {
    await storage.deleteCaseFile(Number(req.params.id));
    res.json({ ok: true });
  });
}
