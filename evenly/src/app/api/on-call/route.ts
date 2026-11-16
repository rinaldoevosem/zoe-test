import { currentInstant } from "@/server/clock";
import { connection, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getSession } from "@/server/session";
import { can } from "@/domain/permissions";
import { clampHours, ONCALL_COLUMNS, onCallRows, whosOnCall } from "@/server/services/oncall";
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
  const hours = clampHours(Number(req.nextUrl.searchParams.get("hours") ?? 24));
  const db = await getDb();
  const result = await whosOnCall(db, actor.departmentId, at, hours);
  if (req.nextUrl.searchParams.get("format") === "csv") {
    // The bulk list of colleagues' phone numbers is for schedulers and the systems they set up, not every User.
    if (!can(actor, "schedule:edit")) return Response.json({ error: "forbidden" }, { status: 403 });
    return new Response(toCsv(onCallRows(result.entries)) || ONCALL_COLUMNS.join(",") + "\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="on-call.csv"', "cache-control": "no-store" },
    });
  }
  return Response.json({ at: new Date(at).toISOString(), hours, ...result }, { headers: { "cache-control": "no-store" } });
}
