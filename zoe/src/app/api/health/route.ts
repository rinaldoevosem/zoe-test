import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export async function GET() {
  await connection();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (e) {
    console.error("health check failed", e);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
