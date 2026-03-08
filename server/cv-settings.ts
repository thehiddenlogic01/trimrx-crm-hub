import type { Express } from "express";
import { storage } from "./storage";

const ALLOWED_KEYS = ["slack_status_rt_options", "sidebar_hidden_items"];

export function setupCvSettingsRoutes(app: Express) {
  app.get("/api/cv-settings/:key", (req, res) => {
    if (!ALLOWED_KEYS.includes(req.params.key)) {
      return res.status(400).json({ error: "Invalid settings key" });
    }
    storage.getSetting(req.params.key).then((value) => {
      if (!value) return res.json({ options: [] });
      try {
        res.json({ options: JSON.parse(value) });
      } catch {
        res.json({ options: [] });
      }
    });
  });

  app.post("/api/cv-settings/:key", (req, res) => {
    if (!ALLOWED_KEYS.includes(req.params.key)) {
      return res.status(400).json({ error: "Invalid settings key" });
    }
    const { options } = req.body;
    if (!Array.isArray(options)) {
      return res.status(400).json({ error: "Options must be an array" });
    }
    storage.setSetting(req.params.key, JSON.stringify(options)).then(() => {
      res.json({ ok: true });
    });
  });
}
