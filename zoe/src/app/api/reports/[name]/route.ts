import { connection, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getSession } from "@/server/session";
import { DomainError } from "@/server/services/common";
import { loadReport, payrollReport, toCsv } from "@/server/services/reports";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest, { params }: RouteContext<"/api/reports/[name]">) {
  await connection();
  const actor = await getSession();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  const start = req.nextUrl.searchParams.get("start") ?? "";
  const end = req.nextUrl.searchParams.get("end") ?? "";
  if (!DATE.test(start) || !DATE.test(end)) return new Response("start and end must be YYYY-MM-DD", { status: 400 });
  const db = await getDb();
  try {
    const rows =
      name === "load.csv" ? (await loadReport(db, actor, start, end)).map(({ staffId, ...r }) => ({ ...r, staffId })) :
      name === "payroll.csv" ? await payrollReport(db, actor, start, end) : null;
    if (!rows) return new Response("Not found", { status: 404 });
    return new Response(toCsv(rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="zoe-${name.replace(".csv", "")}-${start}-${end}.csv"` },
    });
  } catch (e) {
    if (e instanceof DomainError) return new Response(e.message, { status: 403 });
    throw e;
  }
}
