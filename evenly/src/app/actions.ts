"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PREFERENCE_KINDS, type Violation } from "@/domain/types";
import { brokenAssignmentsPhrase } from "@/lib/format";
import { getDb } from "@/server/db";
import { requireSession, signIn, signOut } from "@/server/session";
import { DomainError } from "@/server/services/common";
import * as calendar from "@/server/services/calendar";
import * as reports from "@/server/services/reports";
import * as schedule from "@/server/services/schedule";
import * as settings from "@/server/services/settings";
import * as timeoff from "@/server/services/timeoff";
import * as trades from "@/server/services/trades";
import * as inbox from "@/server/services/notifications";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; violations?: Violation[] };

/** Runs a service call as the signed-in User, turning refusals into a result the UI can show. */
async function run<T>(fn: (db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof requireSession>>) => Promise<T>, message?: (r: T) => string): Promise<ActionResult<T>> {
  const actor = await requireSession();
  const db = await getDb();
  try {
    const data = await fn(db, actor);
    revalidatePath("/", "layout");
    return { ok: true, data, message: message?.(data) };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message, violations: e.violations };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join("; ") };
    throw e;
  }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");
const id = z.string().min(1).max(64);

export async function signInAs(userId: string) {
  await signIn(z.string().min(1).parse(userId));
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/signin");
}

export async function createPeriodAction(input: { name: string; startDate: string; endDate: string }) {
  return run(async (db, a) => {
    const p = await schedule.createPeriod(db, a, z.object({ name: z.string().min(1).max(80), startDate: date, endDate: date }).parse(input));
    return { id: p.id };
  }, () => "Schedule Period created");
}

export async function assignAction(shiftId: string, staffId: string) {
  return run((db, a) => schedule.assign(db, a, id.parse(shiftId), id.parse(staffId)), (r) => (r.warnings.length ? `Assigned with ${r.warnings.length} warning(s)` : "Assigned"));
}

export async function assignBlockAction(shiftId: string, staffId: string, days: number) {
  return run(
    (db, a) => schedule.assignBlock(db, a, id.parse(shiftId), id.parse(staffId), z.number().int().min(1).max(31).parse(days)),
    (r) => `Assigned a ${r.added}-day Block${r.warnings.length ? ` with ${r.warnings.length} warning(s)` : ""}`,
  );
}

export async function unassignAction(assignmentId: string) {
  return run((db, a) => schedule.unassign(db, a, id.parse(assignmentId)), () => "Removed");
}

export async function lockAction(assignmentId: string, locked: boolean) {
  return run((db, a) => schedule.setLocked(db, a, id.parse(assignmentId), z.boolean().parse(locked)), () => (locked ? "Locked" : "Unlocked"));
}

export async function autofillAction(periodId: string) {
  return run(
    async (db, a) => {
      const r = await schedule.runAutofill(db, a, id.parse(periodId));
      return { added: r.added.length, unfilled: r.unfilled, autoPublish: r.autoPublish };
    },
    (r) => `Auto-fill added ${r.added} Assignments${r.unfilled.length ? `; ${r.unfilled.length} Shifts still need cover` : ""}` +
      (r.autoPublish ? (r.autoPublish.published ? ". Auto-published." : `. ${r.autoPublish.reason}.`) : ""),
  );
}

export async function clearAutofillAction(periodId: string) {
  return run((db, a) => schedule.clearAutofill(db, a, id.parse(periodId)), (n) => `Cleared ${n} Auto-fill Assignments`);
}

export async function publishAction(periodId: string) {
  return run((db, a) => schedule.publish(db, a, id.parse(periodId)), () => "Published — staff have been notified");
}

export async function candidatesAction(shiftId: string) {
  return run((db, a) => schedule.candidatesFor(db, a, id.parse(shiftId)));
}

export async function limitCheckAction(startDate: string, endDate: string) {
  return run((db, a) => timeoff.limitConflicts(db, a, date.parse(startDate), date.parse(endDate)));
}

export async function requestTimeOffAction(input: { startDate: string; endDate: string; note?: string }) {
  return run(
    (db, a) => timeoff.requestTimeOff(db, a, z.object({ startDate: date, endDate: date, note: z.string().max(500).optional() }).parse(input)),
    () => "Request sent",
  );
}

export async function cancelTimeOffAction(requestId: string) {
  return run((db, a) => timeoff.cancelTimeOff(db, a, id.parse(requestId)), () => "Request cancelled");
}

export async function decideTimeOffAction(requestId: string, decision: "approved" | "denied") {
  return run((db, a) => timeoff.decideTimeOff(db, a, id.parse(requestId), z.enum(["approved", "denied"]).parse(decision)), (r) =>
    decision === "approved"
      ? `Approved${r.conflicts.length ? ` — reassign: ${r.conflicts.map((c) => `${c.label} ${c.date}`).join(", ")}` : ""}`
      : "Denied");
}

const tradeInput = z.object({
  kind: z.enum(["swap", "giveaway", "pickup"]),
  shiftId: z.string().min(1),
  counterpartyId: z.string().optional(),
  counterpartyShiftId: z.string().optional(),
  note: z.string().max(300).optional(),
});

export async function previewTradeAction(input: z.infer<typeof tradeInput>) {
  return run(async (db, a) => {
    const t = tradeInput.parse(input);
    if (!a.staffMemberId) throw new DomainError("Only Staff Members can trade");
    const p = await trades.previewForActor(db, a, { ...t, requesterId: a.staffMemberId });
    return { violations: p.violations, error: p.error ?? null };
  });
}

export async function createTradeAction(input: z.infer<typeof tradeInput>) {
  return run((db, a) => trades.createTrade(db, a, tradeInput.parse(input)), (r) =>
    r.trade.status === "approved" ? "Done — your schedule is updated" : r.trade.status === "accepted" ? "Sent to your scheduler for approval" : "Request sent");
}

export async function tradeAction(tradeId: string, event: "accept" | "decline" | "withdraw" | "approve" | "reject") {
  return run((db, a) => trades.actOnTrade(db, a, id.parse(tradeId), z.enum(["accept", "decline", "withdraw", "approve", "reject"]).parse(event)), (r) =>
    r.status === "approved" ? "Approved — schedules updated" : r.status === "accepted" ? "Accepted — awaiting scheduler approval" : `Trade ${r.status}`);
}

const preferenceInput = z.object({ date, kind: z.enum(PREFERENCE_KINDS), shiftTypeId: id.optional() });

export async function addPreferenceAction(input: z.infer<typeof preferenceInput>) {
  return run((db, a) => timeoff.addPreference(db, a, preferenceInput.parse(input)), () => "Preference saved");
}

export async function removePreferenceAction(preferenceId: string) {
  return run((db, a) => timeoff.removePreference(db, a, id.parse(preferenceId)), () => "Preference removed");
}

export async function rotateCalendarAction() {
  return run((db, a) => calendar.rotateCalendarToken(db, a), () => "New Calendar Feed link created; the old link no longer works");
}

export async function clockAction(direction: "in" | "out") {
  return run((db, a) => reports.clock(db, a, z.enum(["in", "out"]).parse(direction)), () => (direction === "in" ? "Clocked in" : "Clocked out"));
}

export async function markAllReadAction() {
  return run((db, a) => inbox.markAllRead(db, a));
}

const savedMessage = (what: string) => (r: { newHardViolations: unknown[] }) =>
  r.newHardViolations.length ? `${what} saved — ${brokenAssignmentsPhrase(r.newHardViolations.length)}` : `${what} saved`;

export async function saveSettingsAction(input: unknown) {
  return run((db, a) => settings.saveDepartmentSettings(db, a, input), savedMessage("Settings"));
}

export async function saveStaffAction(input: unknown) {
  return run((db, a) => settings.saveStaffMember(db, a, input), savedMessage("Staff Member"));
}

export async function saveShiftTypeAction(input: unknown) {
  return run((db, a) => settings.saveShiftType(db, a, input), savedMessage("Shift Type"));
}

export async function saveChannelSettingsAction(input: unknown) {
  return run((db, a) => inbox.saveChannelSettings(db, a, input), () => "Notification settings saved");
}
