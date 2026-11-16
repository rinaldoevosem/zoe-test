/** Loads domain snapshots from storage. Every query is scoped by Department (and so by Organization). */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { addDays } from "@/domain/time";
import type { ScheduleContext, Shift } from "@/domain/types";
import { schema, type DB } from "./db";

const { assignments, departments, preferences, shiftTypes, shifts, staffMembers, timeOffRequests, schedulePeriods } = schema;

export type Department = typeof departments.$inferSelect;
export type ShiftTypeRow = typeof shiftTypes.$inferSelect;
export type ShiftView = Shift & { periodId: string; code: string; color: string; published: boolean };
export type AssignmentRow = typeof assignments.$inferSelect;

export interface Snapshot {
  department: Department;
  ctx: ScheduleContext;
  shifts: ShiftView[];
  assignmentRows: AssignmentRow[];
}

export async function getDepartment(db: DB, departmentId: string): Promise<Department> {
  const [d] = await db.select().from(departments).where(eq(departments.id, departmentId));
  if (!d) throw new Error("Department not found");
  return d;
}

/**
 * Everything the Rule engine needs for [start, end], padded by a week either side
 * so rest and consecutive-day Rules see neighbouring Shifts.
 */
export async function loadSnapshot(
  db: DB,
  departmentId: string,
  start: string,
  end: string,
  opts: { publishedOnly?: boolean; pad?: number } = {},
): Promise<Snapshot> {
  const pad = opts.pad ?? 7;
  const from = addDays(start, -pad);
  const to = addDays(end, pad);
  const department = await getDepartment(db, departmentId);

  const rows = await db
    .select({ shift: shifts, type: shiftTypes, period: schedulePeriods })
    .from(shifts)
    .innerJoin(shiftTypes, eq(shifts.shiftTypeId, shiftTypes.id))
    .innerJoin(schedulePeriods, eq(shifts.periodId, schedulePeriods.id))
    .where(and(eq(shifts.departmentId, departmentId), gte(shifts.date, from), lte(shifts.date, to)));
  const visible = rows.filter((r) => !opts.publishedOnly || r.period.status === "published");
  const shiftViews: ShiftView[] = visible
    .map(({ shift, type, period }) => ({
      id: shift.id,
      shiftTypeId: type.id,
      label: type.name,
      code: type.code,
      color: type.color,
      date: shift.date,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
      requiredTags: type.requiredTags,
      headcount: shift.headcount,
      weight: type.weight,
      onCall: type.onCall,
      periodId: period.id,
      published: period.status === "published",
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute || a.label.localeCompare(b.label));

  const ids = shiftViews.map((s) => s.id);
  const assignmentRows = ids.length ? await db.select().from(assignments).where(inArray(assignments.shiftId, ids)) : [];
  const staff = await db.select().from(staffMembers).where(and(eq(staffMembers.departmentId, departmentId), eq(staffMembers.active, true)));
  const off = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.departmentId, departmentId), eq(timeOffRequests.status, "approved"), lte(timeOffRequests.startDate, to), gte(timeOffRequests.endDate, from)));
  const staffIds = staff.map((s) => s.id);
  const prefs = staffIds.length
    ? await db.select().from(preferences).where(and(inArray(preferences.staffMemberId, staffIds), gte(preferences.date, from), lte(preferences.date, to)))
    : [];

  return {
    department,
    shifts: shiftViews,
    assignmentRows,
    ctx: {
      timeZone: department.timeZone,
      staff: staff.map((s) => ({ id: s.id, name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags: s.tags })),
      shifts: shiftViews,
      assignments: assignmentRows.map((a) => ({ shiftId: a.shiftId, staffId: a.staffMemberId, locked: a.locked })),
      timeOff: off.map((t) => ({ staffId: t.staffMemberId, startDate: t.startDate, endDate: t.endDate })),
      preferences: prefs.map((p) => ({ staffId: p.staffMemberId, date: p.date, kind: p.kind, ...(p.shiftTypeId ? { shiftTypeId: p.shiftTypeId } : {}) })),
      rules: department.settings.rules,
    },
  };
}

/** Restrict a padded snapshot's Assignments to Shifts within [start, end] (for Load and reports). */
export function within(ctx: ScheduleContext, start: string, end: string): ScheduleContext {
  const inRange = new Set(ctx.shifts.filter((s) => s.date >= start && s.date <= end).map((s) => s.id));
  return { ...ctx, shifts: ctx.shifts.filter((s) => inRange.has(s.id)), assignments: ctx.assignments.filter((a) => inRange.has(a.shiftId)) };
}
