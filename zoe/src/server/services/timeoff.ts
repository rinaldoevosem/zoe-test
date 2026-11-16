import { and, desc, eq, gte, lte } from "drizzle-orm";
import { conflictingAssignments, requestLimitConflicts, validateRange } from "@/domain/timeoff";
import { schema, type DB } from "../db";
import { getDepartment, loadSnapshot } from "../repo";
import { audit, DomainError, notify, require, staffNames, type Actor } from "./common";

const { timeOffRequests, staffMembers, users } = schema;

export async function listTimeOff(db: DB, actor: Actor, scope: "mine" | "department") {
  const where = scope === "mine"
    ? and(eq(timeOffRequests.departmentId, actor.departmentId), eq(timeOffRequests.staffMemberId, actor.staffMemberId ?? "-"))
    : eq(timeOffRequests.departmentId, actor.departmentId);
  return db
    .select({ request: timeOffRequests, name: staffMembers.name })
    .from(timeOffRequests)
    .innerJoin(staffMembers, eq(timeOffRequests.staffMemberId, staffMembers.id))
    .where(where)
    .orderBy(desc(timeOffRequests.createdAt));
}

/** Dates on which the Request Limit is already reached by colleagues, for instant feedback before submitting. */
export async function limitConflicts(db: DB, actor: Actor, startDate: string, endDate: string) {
  const err = validateRange(startDate, endDate);
  if (err) return { error: err, dates: [] as string[], limit: 0 };
  const dept = await getDepartment(db, actor.departmentId);
  const existing = await db.select().from(timeOffRequests).where(and(
    eq(timeOffRequests.departmentId, actor.departmentId), lte(timeOffRequests.startDate, endDate), gte(timeOffRequests.endDate, startDate),
  ));
  const dates = requestLimitConflicts(
    { staffId: actor.staffMemberId ?? "-", startDate, endDate },
    existing.map((r) => ({ staffId: r.staffMemberId, startDate: r.startDate, endDate: r.endDate, status: r.status })),
    dept.settings.requestLimit,
  );
  return { error: null, dates, limit: dept.settings.requestLimit };
}

export async function requestTimeOff(db: DB, actor: Actor, input: { startDate: string; endDate: string; note?: string }) {
  if (!actor.staffMemberId) throw new DomainError("Only Staff Members can request time off");
  const err = validateRange(input.startDate, input.endDate);
  if (err) throw new DomainError(err);
  const { dates } = await limitConflicts(db, actor, input.startDate, input.endDate);
  if (dates.length) throw new DomainError(`The Request Limit is already reached on ${dates.join(", ")}. Choose other dates or ask your scheduler.`);
  const [row] = await db.insert(timeOffRequests).values({
    organizationId: actor.organizationId, departmentId: actor.departmentId, staffMemberId: actor.staffMemberId, ...input,
  }).returning();
  await audit(db, actor, "timeoff.request", `${actor.name} requested time off ${input.startDate} – ${input.endDate}`, { requestId: row.id });
  return row;
}

export async function cancelTimeOff(db: DB, actor: Actor, requestId: string) {
  const [r] = await db.select().from(timeOffRequests).where(and(eq(timeOffRequests.id, requestId), eq(timeOffRequests.departmentId, actor.departmentId)));
  if (!r || r.staffMemberId !== actor.staffMemberId) throw new DomainError("Request not found");
  if (r.status !== "pending") throw new DomainError("Only pending requests can be cancelled");
  await db.update(timeOffRequests).set({ status: "cancelled" }).where(eq(timeOffRequests.id, requestId));
  await audit(db, actor, "timeoff.cancel", `${actor.name} cancelled a time-off request`, { requestId });
}

export async function decideTimeOff(db: DB, actor: Actor, requestId: string, decision: "approved" | "denied") {
  require(actor, "timeoff:decide");
  const [r] = await db.select().from(timeOffRequests).where(and(eq(timeOffRequests.id, requestId), eq(timeOffRequests.departmentId, actor.departmentId)));
  if (!r) throw new DomainError("Request not found");
  if (r.status !== "pending") throw new DomainError(`This request is already ${r.status}`);
  let conflicts: { shiftId: string; label: string; date: string }[] = [];
  if (decision === "approved") {
    const existing = await db.select().from(timeOffRequests).where(eq(timeOffRequests.departmentId, actor.departmentId));
    const dept = await getDepartment(db, actor.departmentId);
    const full = requestLimitConflicts(
      { staffId: r.staffMemberId, startDate: r.startDate, endDate: r.endDate },
      existing.map((x) => ({ staffId: x.staffMemberId, startDate: x.startDate, endDate: x.endDate, status: x.status })),
      dept.settings.requestLimit,
    );
    if (full.length) throw new DomainError(`Approving would exceed the Request Limit (${dept.settings.requestLimit}) on ${full.join(", ")}`);
    const snap = await loadSnapshot(db, actor.departmentId, r.startDate, r.endDate, { pad: 0 });
    const byId = new Map(snap.shifts.map((s) => [s.id, s]));
    conflicts = conflictingAssignments({ staffId: r.staffMemberId, startDate: r.startDate, endDate: r.endDate }, snap.ctx.assignments, snap.ctx.shifts)
      .map((a) => ({ shiftId: a.shiftId, label: byId.get(a.shiftId)!.label, date: byId.get(a.shiftId)!.date }));
  }
  await db.update(timeOffRequests).set({ status: decision, decidedBy: actor.name }).where(eq(timeOffRequests.id, requestId));
  const names = await staffNames(db, [r.staffMemberId]);
  await audit(db, actor, `timeoff.${decision}`, `${decision === "approved" ? "Approved" : "Denied"} ${names.get(r.staffMemberId)}'s time off ${r.startDate} – ${r.endDate}`, { requestId, conflicts });
  await notify(db, actor.organizationId, [r.staffMemberId], {
    category: "request",
    title: `Time off ${decision}`,
    body: `${r.startDate} – ${r.endDate}${conflicts.length ? `. Your scheduler will reassign ${conflicts.length} Shift(s).` : ""}`,
    href: "/time-off",
  });
  return { conflicts };
}

export type { users };
