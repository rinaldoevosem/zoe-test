import { currentInstant } from "@/server/clock";
import { connection, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getSession } from "@/server/session";
import { whosOnCall } from "@/server/services/oncall";

/** Who's On Call as JSON for paging/EHR integrations (session-authenticated in v0; API tokens: ticket 14). */
export async function GET(req: NextRequest) {
  await connection();
  const actor = await getSession();
  if (!actor) return Response.json({ error: "unauthorized" }, { status: 401 });
  const atParam = req.nextUrl.searchParams.get("at");
  const at = atParam && !Number.isNaN(Date.parse(atParam)) ? Date.parse(atParam) : currentInstant();
  const db = await getDb();
  return Response.json({ at: new Date(at).toISOString(), ...(await whosOnCall(db, actor.departmentId, at)) }, { headers: { "cache-control": "no-store" } });
}
