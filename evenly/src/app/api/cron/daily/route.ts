import { connection, type NextRequest } from "next/server";
import { currentInstant } from "@/server/clock";
import { getDb } from "@/server/db";
import { runDailyJob } from "@/server/services/daily";

/**
 * The daily job, called by the host's scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * Refuses every call unless CRON_SECRET is configured and matches.
 */
export async function GET(req: NextRequest) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  return Response.json(await runDailyJob(db, currentInstant()), { headers: { "cache-control": "no-store" } });
}
