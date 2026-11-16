import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { computeLoad, type LoadRow } from "@/domain/load";
import { shiftInterval, instantToLocalDate } from "@/domain/time";
import { schema, type DB } from "../db";
import { loadSnapshot, within } from "../repo";
import { require, DomainError, type Actor } from "./common";

export async function loadReport(db: DB, actor: Actor, start: string, end: string): Promise<LoadRow[]> {
  require(actor, "reports:view");
  const snap = await loadSnapshot(db, actor.departmentId, start, end, { pad: 0 });
  return computeLoad(within(snap.ctx, start, end));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

/** Worked Time Entries reconciled against scheduled Assignments, per Staff Member per day. */
export async function payrollReport(db: DB, actor: Actor, start: string, end: string) {
  require(actor, "reports:view");
  const snap = await loadSnapshot(db, actor.departmentId, start, end, { pad: 0, publishedOnly: true });
  const tz = snap.department.timeZone;
  const staffIds = snap.ctx.staff.map((s) => s.id);
  const entries = staffIds.length ? await db.select().from(schema.timeEntries).where(and(
    inArray(schema.timeEntries.staffMemberId, staffIds),
    gte(schema.timeEntries.clockIn, new Date(Date.parse(start) - 86_400_000)),
    lte(schema.timeEntries.clockIn, new Date(Date.parse(end) + 2 * 86_400_000)),
  )) : [];
  const key = (staffId: string, date: string) => `${staffId}|${date}`;
  const rows = new Map<string, { staff: string; date: string; scheduledHours: number; workedHours: number }>();
  const names = new Map(snap.ctx.staff.map((s) => [s.id, s.name]));
  const shiftById = new Map(snap.shifts.map((s) => [s.id, s]));
  const bump = (staffId: string, date: string, field: "scheduledHours" | "workedHours", hours: number) => {
    if (date < start || date > end) return;
    const k = key(staffId, date);
    const r = rows.get(k) ?? { staff: names.get(staffId) ?? staffId, date, scheduledHours: 0, workedHours: 0 };
    r[field] = Math.round((r[field] + hours) * 100) / 100;
    rows.set(k, r);
  };
  for (const a of snap.ctx.assignments) {
    const s = shiftById.get(a.shiftId);
    if (!s) continue;
    const { start: a0, end: a1 } = shiftInterval(s, tz);
    bump(a.staffId, s.date, "scheduledHours", (a1 - a0) / 3_600_000);
  }
  for (const e of entries) {
    if (!e.clockOut) continue;
    bump(e.staffMemberId, instantToLocalDate(e.clockIn.getTime(), tz), "workedHours", (e.clockOut.getTime() - e.clockIn.getTime()) / 3_600_000);
  }
  return [...rows.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.staff.localeCompare(b.staff))
    .map((r) => ({ ...r, varianceHours: Math.round((r.workedHours - r.scheduledHours) * 100) / 100 }));
}

export async function clock(db: DB, actor: Actor, direction: "in" | "out", now = new Date()) {
  if (!actor.staffMemberId) throw new DomainError("Only Staff Members record time");
  const open = await db.select().from(schema.timeEntries).where(eq(schema.timeEntries.staffMemberId, actor.staffMemberId));
  const current = open.find((e) => !e.clockOut);
  if (direction === "in") {
    if (current) throw new DomainError("You are already clocked in");
    await db.insert(schema.timeEntries).values({ organizationId: actor.organizationId, staffMemberId: actor.staffMemberId, clockIn: now });
  } else {
    if (!current) throw new DomainError("You are not clocked in");
    await db.update(schema.timeEntries).set({ clockOut: now }).where(eq(schema.timeEntries.id, current.id));
  }
}

export async function myTimeEntries(db: DB, actor: Actor, limit = 30) {
  if (!actor.staffMemberId) return [];
  return db.select().from(schema.timeEntries)
    .where(and(eq(schema.timeEntries.organizationId, actor.organizationId), eq(schema.timeEntries.staffMemberId, actor.staffMemberId)))
    .orderBy(desc(schema.timeEntries.clockIn)).limit(limit);
}
