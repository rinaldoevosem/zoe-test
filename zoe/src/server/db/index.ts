import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema>;
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Zero-setup by default: an embedded Postgres (PGlite) persisted under `.data/`.
 * `DATABASE_URL` switches to a real Postgres; `ZOE_DB=memory` gives a throwaway database (tests, e2e).
 */
async function connect(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const [{ drizzle }, { migrate }, { default: postgres }] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
      import("postgres"),
    ]);
    const db = drizzle(postgres(process.env.DATABASE_URL, { max: 10 }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as DB;
  }
  const dataDir = process.env.ZOE_DB === "memory" ? undefined : path.join(process.cwd(), ".data", "pglite");
  return createPgliteDb(dataDir);
}

export async function createPgliteDb(dataDir?: string): Promise<DB> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = drizzlePglite(new PGlite(dataDir), { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db;
}

const globalForDb = globalThis as unknown as { zoeDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!globalForDb.zoeDb) {
    globalForDb.zoeDb = connect().then(async (db) => {
      const { ensureSeeded } = await import("./seed");
      await ensureSeeded(db);
      return db;
    });
    globalForDb.zoeDb.catch(() => (globalForDb.zoeDb = undefined));
  }
  return globalForDb.zoeDb;
}
