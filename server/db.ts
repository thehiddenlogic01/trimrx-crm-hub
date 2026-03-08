import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function ensureSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cv_reports'
    `);
    const existing = cols.rows.map((r: any) => r.column_name);

    const missing: Record<string, string> = {
      sent_to_sheet: "ALTER TABLE cv_reports ADD COLUMN IF NOT EXISTS sent_to_sheet text DEFAULT ''",
      slack_status_rt: "ALTER TABLE cv_reports ADD COLUMN IF NOT EXISTS slack_status_rt text DEFAULT ''",
    };

    for (const [col, sql] of Object.entries(missing)) {
      if (!existing.includes(col)) {
        await pool.query(sql);
        console.log(`Added missing column: ${col}`);
      }
    }
  } catch (e: any) {
    console.warn("ensureSchema warning:", e.message);
  }
}
