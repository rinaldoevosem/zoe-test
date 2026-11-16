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

/** Who's On Call in a Department at `at` (published schedules only), plus the next 24 hours. */
export async function whosOnCall(db: DB, departmentId: string, at: number): Promise<{ department: string; timeZone: string; entries: OnCallEntry[] }> {
  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.id, departmentId));
  if (!dept) throw new Error("Department not found");
  const day = instantToLocalDate(at, dept.timeZone);
  const snap = await loadSnapshot(db, departmentId, addDays(day, -1), addDays(day, 1), { publishedOnly: true, pad: 0 });
  const staff = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.departmentId, departmentId));
  const byId = new Map(staff.map((s) => [s.id, s]));
  const horizon = at + 24 * 3_600_000;
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
