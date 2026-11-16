import { isWeekend, shiftHours } from "./time";
import type { ScheduleContext, StaffId } from "./types";

export interface LoadRow {
  staffId: StaffId;
  name: string;
  fte: number;
  shifts: number;
  hours: number;
  weekendShifts: number;
  onCallShifts: number;
  /** Sum of Shift Weights. */
  weight: number;
  /** weight / FTE (+ prior Load). Fairness means equalising this. */
  load: number;
}

/** Load per Staff Member over the Assignments in the snapshot, sorted by Staff Member id. */
export function computeLoad(ctx: ScheduleContext): LoadRow[] {
  const shifts = new Map(ctx.shifts.map((s) => [s.id, s]));
  return [...ctx.staff]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => {
      const mine = ctx.assignments.filter((a) => a.staffId === m.id).map((a) => shifts.get(a.shiftId)).filter((s) => !!s);
      const weight = mine.reduce((sum, s) => sum + s.weight, 0);
      return {
        staffId: m.id,
        name: m.name,
        fte: m.fte,
        shifts: mine.length,
        hours: round(mine.reduce((sum, s) => sum + shiftHours(s, ctx.timeZone), 0)),
        weekendShifts: mine.filter((s) => isWeekend(s.date)).length,
        onCallShifts: mine.filter((s) => s.onCall).length,
        weight,
        load: round(loadOf(weight, m.fte) + (ctx.priorLoad?.[m.id] ?? 0)),
      };
    });
}

export function loadOf(weight: number, fte: number): number {
  return fte > 0 ? weight / fte : Number.POSITIVE_INFINITY;
}

const round = (n: number) => Math.round(n * 100) / 100;
