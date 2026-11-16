import { currentInstant } from "@/server/clock";
import { connection, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getSession } from "@/server/session";
import { onCallRows, whosOnCall } from "@/server/services/oncall";
import { toCsv } from "@/server/services/reports";

/**
 * Who's On Call for the hospital operator and paging: `?hours=48` sets the window (default 24, max 168),
 * `?format=csv` returns one row per person with stable IDs. Session-authenticated for now; API tokens: v1 ticket 14.
 */
export async function GET(req: NextRequest) {
  await connection();
  const actor = await getSession();
  if (!actor) return Response.json({ error: "unauthorized" }, { status: 401 });
  const atParam = req.nextUrl.searchParams.get("at");
  const at = atParam && !Number.isNaN(Date.parse(atParam)) ? Date.parse(atParam) : currentInstant();
  const hours = Number(req.nextUrl.searchParams.get("hours") ?? 24) || 24;
  const db = await getDb();
  const result = await whosOnCall(db, actor.departmentId, at, hours);
  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new Response(toCsv(onCallRows(result.entries)) || "shift_id,shift_type,code,start,end,staff_id,name,clinical_role,phone\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="on-call.csv"', "cache-control": "no-store" },
    });
  }
  return Response.json({ at: new Date(at).toISOString(), hours: Math.min(168, Math.max(1, Math.round(hours))), ...result }, { headers: { "cache-control": "no-store" } });
}
