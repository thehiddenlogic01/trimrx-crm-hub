import type { Express } from "express";
import { storage } from "./storage";

const ARRAY_KEYS = ["slack_status_rt_options", "sidebar_hidden_items", "sidebar_section_order"];
const OBJECT_KEYS = ["sidebar_menu_order"];
const ADMIN_ONLY_KEYS = ["sidebar_hidden_items", "sidebar_menu_order", "sidebar_section_order"];
const ALLOWED_KEYS = [...ARRAY_KEYS, ...OBJECT_KEYS];

export function setupCvSettingsRoutes(app: Express) {
  app.get("/api/cv-settings/:key", (req, res) => {
    if (!ALLOWED_KEYS.includes(req.params.key)) {
      return res.status(400).json({ error: "Invalid settings key" });
    }
    const defaultVal = OBJECT_KEYS.includes(req.params.key) ? {} : [];
    storage.getSetting(req.params.key).then((value) => {
      if (!value) return res.json({ options: defaultVal });
      try {
        res.json({ options: JSON.parse(value) });
      } catch {
        res.json({ options: defaultVal });
      }
    });
  });

  app.post("/api/cv-settings/:key", (req, res) => {
    if (!ALLOWED_KEYS.includes(req.params.key)) {
      return res.status(400).json({ error: "Invalid settings key" });
    }
    if (ADMIN_ONLY_KEYS.includes(req.params.key)) {
      const user = (req as any).user;
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
    }
    const { options } = req.body;
    if (ARRAY_KEYS.includes(req.params.key)) {
      if (!Array.isArray(options)) {
        return res.status(400).json({ error: "Options must be an array" });
      }
    } else if (OBJECT_KEYS.includes(req.params.key)) {
      if (typeof options !== "object" || Array.isArray(options) || options === null) {
        return res.status(400).json({ error: "Options must be an object" });
      }
    }
    storage.setSetting(req.params.key, JSON.stringify(options)).then(() => {
      res.json({ ok: true });
    });
  });
}
