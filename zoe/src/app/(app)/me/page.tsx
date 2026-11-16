import { currentInstant } from "@/server/clock";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { addDays, instantToLocalDate } from "@/domain/time";
import { PageHeader } from "@/components/page-header";
import { MonthJump } from "@/components/me/month-jump";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prettyDate, shiftColor, timeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDb } from "@/server/db";
import { myTimeOffFrom } from "@/server/services/timeoff";
import { myPendingTradeShiftIds } from "@/server/services/trades";
import { getDepartment, loadSnapshot } from "@/server/repo";
import { requireSession } from "@/server/session";
import { redirect } from "next/navigation";

export const metadata = { title: "My schedule" };

const monthBounds = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = addDays(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10), -1);
  return { start, end };
};
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

export default async function MySchedulePage({ searchParams }: PageProps<"/me">) {
  const actor = await requireSession();
  if (!actor.staffMemberId) redirect("/schedule");
  const me = actor.staffMemberId;
  const db = await getDb();
  const sp = await searchParams;
  const tz = (await getDepartment(db, actor.departmentId)).timeZone;
  const today = instantToLocalDate(currentInstant(), tz);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const snap = await loadSnapshot(db, actor.departmentId, start, end, { publishedOnly: true, pad: 0 });
  const mine = snap.shifts.filter((s) => snap.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === me));
  const names = new Map(snap.ctx.staff.map((s) => [s.id, s.name]));
  const colleagues = (shiftId: string) => snap.ctx.assignments.filter((a) => a.shiftId === shiftId && a.staffId !== me).map((a) => names.get(a.staffId));

  const timeOff = await myTimeOffFrom(db, actor, start);
  const offIn = timeOff.filter((t) => t.startDate <= end && (t.status === "approved" || t.status === "pending"));
  const pendingTrade = await myPendingTradeShiftIds(db, actor);

  const upcoming = await loadSnapshot(db, actor.departmentId, today, addDays(today, 30), { publishedOnly: true, pad: 0 });
  const next = upcoming.shifts.find((s) => s.date >= today && upcoming.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === me));
  const days = new Map<string, typeof mine>();
  for (const s of mine) days.set(s.date, [...(days.get(s.date) ?? []), s]);
  const hours = mine.reduce((h, s) => h + (s.endMinute - s.startMinute) / 60, 0);
  const label = new Date(start + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="My schedule" description="Published Shifts only. Pending time off and trades are shown inline." />
      {next && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardHeader className="pb-0"><CardTitle className="text-sm font-medium text-muted-foreground">Next up</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{next.label}{next.onCall && <Phone className="ml-2 inline size-4" />}</div>
              <div className="text-sm text-muted-foreground">{prettyDate(next.date, { weekday: "long", month: "long", day: "numeric" })} · {timeRange(next.startMinute, next.endMinute)}</div>
            </div>
            {next.date === today && <Badge>Today</Badge>}
          </CardContent>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon"><Link href={`/me?month=${shiftMonth(month, -1)}`} aria-label="Previous month"><ChevronLeft /></Link></Button>
          <h2 className="min-w-40 text-center font-semibold">{label}</h2>
          <Button asChild variant="outline" size="icon"><Link href={`/me?month=${shiftMonth(month, 1)}`} aria-label="Next month"><ChevronRight /></Link></Button>
        </div>
        <MonthJump value={month} />
        <div className="text-sm text-muted-foreground">{mine.length} Shifts · {Math.round(hours)}h</div>
      </div>
      {offIn.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {offIn.map((t) => (
            <Badge key={t.id} variant={t.status === "approved" ? "default" : "outline"}>
              Time off {prettyDate(t.startDate)} – {prettyDate(t.endDate)} · {t.status}
            </Badge>
          ))}
        </div>
      )}
      {mine.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No published Shifts this month.</CardContent></Card>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="agenda">
          {[...days].map(([date, list]) => (
            <li key={date} className={cn("flex gap-3 rounded-lg border bg-card p-3", date === today && "border-primary", date < today && "opacity-60")}>
              <div className="w-12 shrink-0 text-center">
                <div className="text-xs uppercase text-muted-foreground">{prettyDate(date, { weekday: "short" })}</div>
                <div className="text-xl font-semibold tabular-nums">{Number(date.slice(8))}</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {list.map((s) => (
                  <div key={s.id} className={cn("rounded-md border px-3 py-2", shiftColor(s.color))}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.label}{s.onCall && <Phone className="ml-1.5 inline size-3.5" />}</span>
                      <span className="text-xs tabular-nums">{timeRange(s.startMinute, s.endMinute)}</span>
                    </div>
                    {colleagues(s.id).length > 0 && <div className="mt-0.5 truncate text-xs opacity-80">with {colleagues(s.id).join(", ")}</div>}
                    {pendingTrade.has(s.id) && <Badge variant="outline" className="mt-1">trade pending</Badge>}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
