import { storage } from "./storage";
import { log } from "./index";

export async function seedDefaultUser() {
  try {
    const existing = await storage.getUserByUsername("admin");
    if (!existing) {
      const user = await storage.createUser({ username: "admin", password: "2816" });
      await storage.updateUser(user.id, { role: "admin" });
      log("Default admin user created", "seed");
    } else {
      if (existing.role !== "admin") {
        await storage.updateUser(existing.id, { role: "admin" });
        log("Updated admin user role", "seed");
      }
      log("Default admin user already exists", "seed");
    }
  } catch (err) {
    log(`Error seeding default user: ${err}`, "seed");
  }
}
