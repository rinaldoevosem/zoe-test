import { currentInstant } from "@/server/clock";
import { redirect } from "next/navigation";
import { can } from "@/domain/permissions";
import { evaluate } from "@/domain/rules";
import { eachDate, instantToLocalDate } from "@/domain/time";
import { PageHeader } from "@/components/page-header";
import { ScheduleGrid, type GridCell } from "@/components/schedule/schedule-grid";
import { ScheduleToolbar } from "@/components/schedule/schedule-toolbar";
import { PeriodPicker } from "@/components/schedule/period-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { shortName } from "@/lib/format";
import { getDb } from "@/server/db";
import { loadSnapshot } from "@/server/repo";
import { requireSession } from "@/server/session";
import { listPeriods } from "@/server/services/schedule";
import { listShiftTypes } from "@/server/services/settings";

export const metadata = { title: "Schedule builder" };

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const actor = await requireSession();
  if (!can(actor, "schedule:edit")) redirect("/me");
  const db = await getDb();
  const sp = await searchParams;
  const periods = await listPeriods(db, actor);
  const types = (await listShiftTypes(db, actor)).filter((t) => t.active);
  const snapDept = periods.length ? await loadSnapshot(db, actor.departmentId, periods[0].startDate, periods[0].startDate, { pad: 0 }) : null;
  const today = instantToLocalDate(currentInstant(), snapDept?.department.timeZone ?? "UTC");
  const period =
    periods.find((p) => p.id === sp.period) ??
    periods.find((p) => p.startDate <= today && today <= p.endDate) ??
    periods[periods.length - 1];

  if (!period) {
    return (
      <>
        <PageHeader title="Schedule builder"><ScheduleToolbar period={null} today={today} /></PageHeader>
        <Empty><EmptyHeader><EmptyTitle>No Schedule Periods yet</EmptyTitle><EmptyDescription>Create one to generate Shifts from your Shift Types.</EmptyDescription></EmptyHeader></Empty>
      </>
    );
  }

  const snap = await loadSnapshot(db, actor.departmentId, period.startDate, period.endDate);
  const inPeriod = snap.shifts.filter((s) => s.periodId === period.id);
  const inPeriodIds = new Set(inPeriod.map((s) => s.id));
  const violations = evaluate(snap.ctx).filter((v) => inPeriodIds.has(v.shiftId));
  const names = new Map(snap.ctx.staff.map((s) => [s.id, s.name]));
  const cells: Record<string, GridCell> = {};
  for (const s of inPeriod) {
    const rows = snap.assignmentRows.filter((a) => a.shiftId === s.id);
    cells[`${s.date}|${s.shiftTypeId}`] = {
      shift: { id: s.id, label: s.label, code: s.code, color: s.color, date: s.date, startMinute: s.startMinute, endMinute: s.endMinute, headcount: s.headcount, requiredTags: s.requiredTags, onCall: s.onCall, weight: s.weight },
      assignees: rows.map((a) => ({
        assignmentId: a.id,
        staffId: a.staffMemberId,
        name: names.get(a.staffMemberId) ?? "Unknown",
        short: shortName(names.get(a.staffMemberId) ?? "?"),
        locked: a.locked,
        source: a.source,
        explanation: a.explanation,
        violations: violations.filter((v) => v.shiftId === s.id && v.staffId === a.staffMemberId),
      })),
    };
  }
  const needed = inPeriod.reduce((n, s) => n + s.headcount, 0);
  const filled = inPeriod.reduce((n, s) => n + Math.min(s.headcount, snap.ctx.assignments.filter((a) => a.shiftId === s.id).length), 0);
  const hard = violations.filter((v) => v.severity === "hard").length;
  const soft = violations.length - hard;

  return (
    <>
      <PageHeader
        title="Schedule builder"
        description={<>Click any cell to assign. Hard Rules block; Soft Rules warn. Auto-fill only fills Coverage Gaps and never moves Locked Assignments.</>}
      >
        <ScheduleToolbar period={{ id: period.id, status: period.status, name: period.name }} today={today} />
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <PeriodPicker periods={periods.map((p) => ({ id: p.id, name: p.name, status: p.status }))} current={period.id} />
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="Coverage" value={`${needed ? Math.round((filled / needed) * 100) : 100}%`} />
          <Stat label="Gaps" value={String(needed - filled)} tone={needed - filled ? "warn" : "ok"} />
          <Stat label="Hard" value={String(hard)} tone={hard ? "bad" : "ok"} />
          <Stat label="Soft" value={String(soft)} tone={soft ? "warn" : "ok"} />
          <Badge variant={period.status === "published" ? "default" : "secondary"} className="h-8 px-3 capitalize">{period.status}</Badge>
        </div>
      </div>
      <Card className="py-0">
        <CardContent className="p-0">
          <ScheduleGrid
            dates={eachDate(period.startDate, period.endDate)}
            types={types.map((t) => ({ id: t.id, code: t.code, name: t.name, color: t.color, onCall: t.onCall }))}
            cells={cells}
            today={today}
          />
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border bg-card px-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// Reads the session and the clock on every request (ADR-0008).
export const instant = false;
