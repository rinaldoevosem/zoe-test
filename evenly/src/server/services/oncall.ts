import { eq } from "drizzle-orm";
import { addDays, instantToLocalDate, shiftInterval } from "@/domain/time";
import { schema, type DB } from "../db";
import { loadSnapshot } from "../repo";

export interface OnCallEntry {
  shiftId: string;
  label: string;
  code: string;
  date: string;
  start: string;
  end: string;
  onNow: boolean;
  staff: { id: string; name: string; clinicalRole: string; phone: string | null; email: string | null }[];
}

/** Who's On Call in a Department at `at` (published schedules only), through the next `hours` (default 24, at most a week). */
export async function whosOnCall(db: DB, departmentId: string, at: number, hours = 24): Promise<{ department: string; timeZone: string; entries: OnCallEntry[] }> {
  hours = clampHours(hours);
  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.id, departmentId));
  if (!dept) throw new Error("Department not found");
  const day = instantToLocalDate(at, dept.timeZone);
  const snap = await loadSnapshot(db, departmentId, addDays(day, -1), addDays(day, Math.ceil(hours / 24) + 1), { publishedOnly: true, pad: 0 });
  const staff = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.departmentId, departmentId));
  const byId = new Map(staff.map((s) => [s.id, s]));
  const horizon = at + hours * 3_600_000;
  const entries = snap.shifts
    .filter((s) => s.onCall)
    .map((s) => ({ s, ...shiftInterval(s, dept.timeZone) }))
    .filter(({ start, end }) => end > at && start < horizon)
    .sort((a, b) => a.start - b.start)
    .map(({ s, start, end }) => ({
      shiftId: s.id,
      label: s.label,
      code: s.code,
      date: s.date,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      onNow: start <= at && at < end,
      staff: snap.ctx.assignments.filter((a) => a.shiftId === s.id).map((a) => byId.get(a.staffId)!).filter(Boolean)
        .map((m) => ({ id: m.id, name: m.name, clinicalRole: m.clinicalRole, phone: m.phone, email: m.email })),
    }));
  return { department: dept.name, timeZone: dept.timeZone, entries };
}

/** The on-call window: whole hours from 1 to a week. */
export const clampHours = (hours: number) => Math.min(168, Math.max(1, Math.round(hours) || 24));

export const ONCALL_COLUMNS = ["shift_id", "shift_type", "code", "start", "end", "staff_id", "name", "clinical_role", "phone"] as const;

/** One row per person per on-call Shift, with stable IDs, for the hospital operator and paging systems. */
export function onCallRows(entries: OnCallEntry[]) {
  return entries.flatMap((e) => (e.staff.length ? e.staff : [null]).map((m) => ({
    shift_id: e.shiftId, shift_type: e.label, code: e.code, start: e.start, end: e.end,
    staff_id: m?.id ?? "", name: m?.name ?? "UNCOVERED", clinical_role: m?.clinicalRole ?? "", phone: m?.phone ?? "",
  })));
}
