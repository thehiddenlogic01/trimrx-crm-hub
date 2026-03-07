import { type Express } from "express";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

export function setupUserRoutes(app: Express) {
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(parsed);
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid data" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { role, permissions, featurePermissions } = req.body;
      const updates: Partial<{ role: string; permissions: string; featurePermissions: string }> = {};
      if (role !== undefined) updates.role = role;
      if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
      if (featurePermissions !== undefined) updates.featurePermissions = JSON.stringify(featurePermissions);
      const updated = await storage.updateUser(id, updates);
      if (!updated) return res.status(500).json({ message: "Update failed" });
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid data" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.username === "admin") {
        return res.status(403).json({ message: "Cannot delete the default admin user" });
      }
      await storage.deleteUser(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete user" });
    }
  });
}
