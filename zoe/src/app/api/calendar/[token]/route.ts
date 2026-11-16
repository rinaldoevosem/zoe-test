import { currentInstant } from "@/server/clock";
import { connection } from "next/server";
import { instantToLocalDate } from "@/domain/time";
import { getDb } from "@/server/db";
import { renderFeed } from "@/server/services/calendar";

/** Calendar Feed (ADR-0006): rendered on every request, so it is never stale. */
export async function GET(_req: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  await connection();
  const { token } = await params;
  const db = await getDb();
  const ics = await renderFeed(db, token.replace(/\.ics$/, ""), instantToLocalDate(currentInstant(), "UTC"));
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "content-disposition": 'inline; filename="zoe.ics"' },
  });
}
