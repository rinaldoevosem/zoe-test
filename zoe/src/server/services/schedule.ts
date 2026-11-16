/** Schedule Periods, Assignments, Auto-fill and Publish. Every write is judged by the Rule engine (ADR-0002). */
import { and, eq, inArray } from "drizzle-orm";
import { autofill, type AutofillResult } from "@/domain/autofill";
import { computeLoad } from "@/domain/load";
import { checkAssignment, hasHard, totalPenalty } from "@/domain/rules";
import { addDays, eachDate, weekday } from "@/domain/time";
import type { Violation } from "@/domain/types";
import { schema, type DB } from "../db";
import { loadSnapshot, within } from "../repo";
import { audit, DomainError, notify, require, staffNames, type Actor } from "./common";

const { assignments, schedulePeriods, shiftTypes, shifts } = schema;

export async function getPeriod(db: DB, actor: Actor, periodId: string) {
  const [p] = await db.select().from(schedulePeriods).where(and(eq(schedulePeriods.id, periodId), eq(schedulePeriods.departmentId, actor.departmentId)));
  if (!p) throw new DomainError("Schedule Period not found");
  return p;
}

export async function listPeriods(db: DB, actor: Actor) {
  const rows = await db.select().from(schedulePeriods).where(eq(schedulePeriods.departmentId, actor.departmentId));
  return rows.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function createPeriod(db: DB, actor: Actor, input: { name: string; startDate: string; endDate: string }) {
  require(actor, "schedule:edit");
  if (input.endDate < input.startDate) throw new DomainError("End date is before start date");
  if (eachDate(input.startDate, input.endDate).length > 92) throw new DomainError("Schedule Periods are limited to 92 days");
  const existing = await listPeriods(db, actor);
  if (existing.some((p) => p.startDate <= input.endDate && input.startDate <= p.endDate)) {
    throw new DomainError("This range overlaps an existing Schedule Period");
  }
  const [period] = await db
    .insert(schedulePeriods)
    .values({ organizationId: actor.organizationId, departmentId: actor.departmentId, ...input })
    .returning();
  const types = await db.select().from(shiftTypes).where(and(eq(shiftTypes.departmentId, actor.departmentId), eq(shiftTypes.active, true)));
  const rows = eachDate(input.startDate, input.endDate).flatMap((date) =>
    types
      .filter((t) => t.weekdays.includes(weekday(date)))
      .map((t) => ({
        organizationId: actor.organizationId,
        departmentId: actor.departmentId,
        periodId: period.id,
        shiftTypeId: t.id,
        date,
        startMinute: t.startMinute,
        endMinute: t.endMinute,
        headcount: t.headcount,
      })),
  );
  for (let i = 0; i < rows.length; i += 500) await db.insert(shifts).values(rows.slice(i, i + 500));
  await audit(db, actor, "period.create", `Created ${period.name} (${period.startDate} – ${period.endDate}) with ${rows.length} Shifts`, { periodId: period.id });
  return period;
}

async function shiftInDepartment(db: DB, actor: Actor, shiftId: string) {
  const [row] = await db
    .select({ shift: shifts, period: schedulePeriods, type: shiftTypes })
    .from(shifts)
    .innerJoin(schedulePeriods, eq(shifts.periodId, schedulePeriods.id))
    .innerJoin(shiftTypes, eq(shifts.shiftTypeId, shiftTypes.id))
    .where(and(eq(shifts.id, shiftId), eq(shifts.departmentId, actor.departmentId)));
  if (!row) throw new DomainError("Shift not found");
  return row;
}

export interface CandidateView {
  staffId: string;
  name: string;
  clinicalRole: string;
  fte: number;
  load: number;
  violations: Violation[];
  blocked: boolean;
  penalty: number;
}

/** Everyone who could take the Shift, ranked: allowed first, then lowest Load, then lowest Penalty. */
export async function candidatesFor(db: DB, actor: Actor, shiftId: string): Promise<CandidateView[]> {
  require(actor, "schedule:edit");
  const { shift, period } = await shiftInDepartment(db, actor, shiftId);
  const snap = await loadSnapshot(db, actor.departmentId, period.startDate, period.endDate);
  const loads = new Map(computeLoad(within(snap.ctx, period.startDate, period.endDate)).map((r) => [r.staffId, r.load]));
  return snap.ctx.staff
    .filter((m) => !snap.ctx.assignments.some((a) => a.shiftId === shift.id && a.staffId === m.id))
    .map((m) => {
      // Headcount is shown separately (the Shift is full); judge each person on their own Rules.
      const vs = checkAssignment(snap.ctx, { shiftId: shift.id, staffId: m.id }).filter((v) => v.rule !== "headcount");
      return { staffId: m.id, name: m.name, clinicalRole: m.clinicalRole, fte: m.fte, load: loads.get(m.id) ?? 0, violations: vs, blocked: hasHard(vs), penalty: totalPenalty(vs) };
    })
    .sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.load - b.load || a.penalty - b.penalty || a.name.localeCompare(b.name));
}

export async function assign(db: DB, actor: Actor, shiftId: string, staffId: string, opts: { source?: "manual" | "trade" } = {}) {
  require(actor, "schedule:edit");
  const { shift, period, type } = await shiftInDepartment(db, actor, shiftId);
  const snap = await loadSnapshot(db, actor.departmentId, shift.date, shift.date);
  if (!snap.ctx.staff.some((m) => m.id === staffId)) throw new DomainError("Staff Member not found in this Department");
  const vs = checkAssignment(snap.ctx, { shiftId, staffId });
  if (hasHard(vs)) throw new DomainError("This Assignment breaks a Hard Rule", vs);
  await db.insert(assignments).values({ organizationId: actor.organizationId, shiftId, staffMemberId: staffId, source: opts.source ?? "manual" });
  const names = await staffNames(db, [staffId]);
  await audit(db, actor, "assignment.add", `Assigned ${names.get(staffId)} to ${type.name} on ${shift.date}`, { shiftId, staffId, warnings: vs.map((v) => v.message) });
  if (period.status === "published") {
    await notify(db, actor.organizationId, [staffId], { category: "schedule", title: "You were added to a Shift", body: `${type.name} on ${shift.date}`, href: "/me" });
  }
  return { warnings: vs };
}

export async function unassign(db: DB, actor: Actor, assignmentId: string) {
  require(actor, "schedule:edit");
  const [a] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.organizationId, actor.organizationId)));
  if (!a) throw new DomainError("Assignment not found");
  const { shift, period, type } = await shiftInDepartment(db, actor, a.shiftId);
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  const names = await staffNames(db, [a.staffMemberId]);
  await audit(db, actor, "assignment.remove", `Removed ${names.get(a.staffMemberId)} from ${type.name} on ${shift.date}`, { shiftId: shift.id, staffId: a.staffMemberId });
  if (period.status === "published") {
    await notify(db, actor.organizationId, [a.staffMemberId], { category: "schedule", title: "You were removed from a Shift", body: `${type.name} on ${shift.date}`, href: "/me" });
  }
}

export async function setLocked(db: DB, actor: Actor, assignmentId: string, locked: boolean) {
  require(actor, "schedule:edit");
  const [a] = await db.update(assignments).set({ locked, updatedAt: new Date() })
    .where(and(eq(assignments.id, assignmentId), eq(assignments.organizationId, actor.organizationId))).returning();
  if (!a) throw new DomainError("Assignment not found");
  await audit(db, actor, locked ? "assignment.lock" : "assignment.unlock", `${locked ? "Locked" : "Unlocked"} an Assignment`, { assignmentId });
}

export async function runAutofill(db: DB, actor: Actor, periodId: string): Promise<AutofillResult> {
  require(actor, "schedule:edit");
  const period = await getPeriod(db, actor, periodId);
  const snap = await loadSnapshot(db, actor.departmentId, period.startDate, period.endDate);
  // Only this period's Coverage Gaps are filled; neighbouring Shifts are context for the Rules.
  const inPeriod = new Set(snap.shifts.filter((s) => s.periodId === periodId).map((s) => s.id));
  // Fairness carries across periods: Load from the 8 weeks before the padded window counts as history.
  const history = await loadSnapshot(db, actor.departmentId, addDays(period.startDate, -63), addDays(period.startDate, -8), { pad: 0 });
  const priorLoad = Object.fromEntries(computeLoad(history.ctx).map((r) => [r.staffId, r.load]));
  const result = autofill({
    ...snap.ctx,
    priorLoad,
    shifts: snap.ctx.shifts.map((s) => (inPeriod.has(s.id) ? s : { ...s, headcount: 0 })),
  });
  const added = result.added.filter((a) => inPeriod.has(a.shiftId));
  const why = new Map(result.explanations.map((e) => [`${e.shiftId}|${e.staffId}`, e.summary]));
  if (added.length) {
    const rows = added.map((a) => ({
      organizationId: actor.organizationId,
      shiftId: a.shiftId,
      staffMemberId: a.staffId,
      source: "autofill" as const,
      explanation: why.get(`${a.shiftId}|${a.staffId}`) ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) await db.insert(assignments).values(rows.slice(i, i + 500));
  }
  const unfilled = result.unfilled.filter((u) => inPeriod.has(u.shiftId));
  await audit(db, actor, "autofill.run", `Auto-fill added ${added.length} Assignments to ${period.name}; ${unfilled.length} Shifts still have Coverage Gaps`, { periodId });
  if (period.status === "published" && added.length) {
    await notify(db, actor.organizationId, added.map((a) => a.staffId), { category: "schedule", title: "New Shifts on your schedule", body: `Auto-fill added Shifts in ${period.name}`, href: "/me" });
  }
  return { added, explanations: result.explanations.filter((e) => inPeriod.has(e.shiftId)), unfilled };
}

/** Removes every unlocked Auto-fill Assignment in a draft period, so Auto-fill can be re-run cleanly. */
export async function clearAutofill(db: DB, actor: Actor, periodId: string) {
  require(actor, "schedule:edit");
  const period = await getPeriod(db, actor, periodId);
  if (period.status === "published") throw new DomainError("Clear is only available on draft periods");
  const ids = (await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.periodId, periodId))).map((r) => r.id);
  if (!ids.length) return 0;
  const removed = await db.delete(assignments)
    .where(and(inArray(assignments.shiftId, ids), eq(assignments.source, "autofill"), eq(assignments.locked, false)))
    .returning({ id: assignments.id });
  await audit(db, actor, "autofill.clear", `Cleared ${removed.length} unlocked Auto-fill Assignments from ${period.name}`, { periodId });
  return removed.length;
}

export async function publish(db: DB, actor: Actor, periodId: string) {
  require(actor, "schedule:publish");
  const period = await getPeriod(db, actor, periodId);
  if (period.status === "published") throw new DomainError("Already published");
  await db.update(schedulePeriods).set({ status: "published", publishedAt: new Date() }).where(eq(schedulePeriods.id, periodId));
  const ids = (await db.select({ id: shifts.id }).from(shifts).where(eq(shifts.periodId, periodId))).map((r) => r.id);
  const staffIds = ids.length
    ? (await db.select({ s: assignments.staffMemberId }).from(assignments).where(inArray(assignments.shiftId, ids))).map((r) => r.s)
    : [];
  await notify(db, actor.organizationId, staffIds, { category: "schedule", title: `${period.name} is published`, body: "Your Shifts are now final and in your Calendar Feed.", href: "/me" });
  await audit(db, actor, "period.publish", `Published ${period.name}`, { periodId });
}
