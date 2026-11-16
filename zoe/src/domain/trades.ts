/**
 * Trade Requests: Swap, Giveaway and Pickup (of a Coverage Gap), as a state machine.
 * Rule-clean trades are approved automatically when the Department policy is "auto" (ADR-0005).
 *
 * Interface:
 *   previewTrade(trade, ctx)              → the schedule change and the Violations it would introduce
 *   transition(trade, event, ctx, policy) → next Trade + the Assignment changes to apply, or an error
 */
import { evaluate, hasHard, newViolations } from "./rules";
import type { Assignment, ScheduleContext, ShiftId, StaffId, Violation } from "./types";

export type TradeKind = "swap" | "giveaway" | "pickup";
export type TradeStatus = "open" | "accepted" | "approved" | "rejected" | "withdrawn" | "declined";
export type TradePolicy = "auto" | "manual";

export interface Trade {
  kind: TradeKind;
  status: TradeStatus;
  /** Who started the trade. For a Pickup, the Staff Member picking up. */
  requesterId: StaffId;
  /** Swap/Giveaway: the requester's Shift. Pickup: the Coverage Gap Shift. */
  shiftId: ShiftId;
  /** Swap: the colleague asked. Giveaway: whoever accepted it. */
  counterpartyId?: StaffId;
  /** Swap only: the counterparty's Shift the requester takes in return. */
  counterpartyShiftId?: ShiftId;
}

export type TradeEvent =
  | { type: "accept"; by: StaffId }
  | { type: "decline"; by: StaffId }
  | { type: "withdraw"; by: StaffId }
  | { type: "approve" }
  | { type: "reject" };

export interface AssignmentChange {
  remove: Assignment[];
  add: Assignment[];
}

export type TransitionResult =
  | { ok: true; trade: Trade; apply?: AssignmentChange; violations: Violation[] }
  | { ok: false; error: string; violations: Violation[] };

/** The Assignment change a trade makes once both sides are known. */
export function tradeChange(trade: Trade): AssignmentChange | null {
  const { kind, requesterId, shiftId, counterpartyId, counterpartyShiftId } = trade;
  if (kind === "pickup") return { remove: [], add: [{ shiftId, staffId: requesterId }] };
  if (!counterpartyId) return null;
  if (kind === "giveaway") {
    return { remove: [{ shiftId, staffId: requesterId }], add: [{ shiftId, staffId: counterpartyId }] };
  }
  if (!counterpartyShiftId) return null;
  return {
    remove: [{ shiftId, staffId: requesterId }, { shiftId: counterpartyShiftId, staffId: counterpartyId }],
    add: [{ shiftId, staffId: counterpartyId }, { shiftId: counterpartyShiftId, staffId: requesterId }],
  };
}

export function applyChange(assignments: Assignment[], change: AssignmentChange): Assignment[] {
  const removed = (a: Assignment) => change.remove.some((r) => r.shiftId === a.shiftId && r.staffId === a.staffId);
  return [...assignments.filter((a) => !removed(a)), ...change.add];
}

/** Violations the trade would newly introduce (Hard ones block it). */
export function previewTrade(trade: Trade, ctx: ScheduleContext): { change: AssignmentChange | null; violations: Violation[]; error?: string } {
  const change = tradeChange(trade);
  if (!change) return { change, violations: [] };
  const missing = change.remove.find((r) => !ctx.assignments.some((a) => a.shiftId === r.shiftId && a.staffId === r.staffId));
  if (missing) return { change, violations: [], error: "The schedule changed: an Assignment in this trade no longer exists" };
  const before = evaluate(ctx);
  const after = evaluate({ ...ctx, assignments: applyChange(ctx.assignments, change) });
  return { change, violations: newViolations(before, after) };
}

export function openTrade(trade: Omit<Trade, "status">, ctx: ScheduleContext, policy: TradePolicy): TransitionResult {
  const owns = (staffId: StaffId, shiftId?: ShiftId) => !!shiftId && ctx.assignments.some((a) => a.staffId === staffId && a.shiftId === shiftId);
  if (trade.kind !== "pickup" && !owns(trade.requesterId, trade.shiftId)) return fail("You can only trade your own Assignments");
  if (trade.kind === "swap") {
    if (!trade.counterpartyId || !owns(trade.counterpartyId, trade.counterpartyShiftId)) return fail("Choose a colleague's Assignment to swap for");
    if (trade.counterpartyId === trade.requesterId) return fail("You can't swap with yourself");
  }
  const draft: Trade = { ...trade, status: "open" };
  if (trade.kind === "pickup") {
    const shift = ctx.shifts.find((s) => s.id === trade.shiftId);
    if (!shift) return fail("Shift not found");
    if (ctx.assignments.filter((a) => a.shiftId === shift.id).length >= shift.headcount) return fail("This Shift is already covered");
    return settle({ ...draft, status: "accepted" }, ctx, policy);
  }
  const preview = previewTrade(draft, ctx);
  if (preview.error) return fail(preview.error);
  if (hasHard(preview.violations)) return fail("This swap would break a Hard Rule", preview.violations);
  return { ok: true, trade: draft, violations: preview.violations };
}

export function transition(trade: Trade, event: TradeEvent, ctx: ScheduleContext, policy: TradePolicy): TransitionResult {
  switch (event.type) {
    case "withdraw":
      if (event.by !== trade.requesterId) return fail("Only the requester can withdraw");
      if (trade.status !== "open" && trade.status !== "accepted") return fail(`Can't withdraw a ${trade.status} trade`);
      return { ok: true, trade: { ...trade, status: "withdrawn" }, violations: [] };
    case "decline":
      if (trade.status !== "open") return fail(`Can't decline a ${trade.status} trade`);
      if (trade.kind !== "swap" || event.by !== trade.counterpartyId) return fail("Only the colleague asked can decline");
      return { ok: true, trade: { ...trade, status: "declined" }, violations: [] };
    case "accept": {
      if (trade.status !== "open") return fail(`Can't accept a ${trade.status} trade`);
      if (event.by === trade.requesterId) return fail("You can't accept your own trade");
      if (trade.kind === "swap" && event.by !== trade.counterpartyId) return fail("This swap was offered to someone else");
      return settle({ ...trade, counterpartyId: event.by, status: "accepted" }, ctx, policy);
    }
    case "approve": {
      if (trade.status !== "accepted") return fail(`Can't approve a ${trade.status} trade`);
      return settle(trade, ctx, "auto");
    }
    case "reject":
      if (trade.status !== "accepted" && trade.status !== "open") return fail(`Can't reject a ${trade.status} trade`);
      return { ok: true, trade: { ...trade, status: "rejected" }, violations: [] };
  }
}

/** Accepted trade: re-check against the current schedule; apply now if policy allows. */
function settle(accepted: Trade, ctx: ScheduleContext, policy: TradePolicy): TransitionResult {
  const preview = previewTrade(accepted, ctx);
  if (preview.error) return fail(preview.error);
  if (hasHard(preview.violations)) return fail("This trade would break a Hard Rule", preview.violations);
  if (policy === "manual") return { ok: true, trade: accepted, violations: preview.violations };
  return { ok: true, trade: { ...accepted, status: "approved" }, apply: preview.change!, violations: preview.violations };
}

const fail = (error: string, violations: Violation[] = []): TransitionResult => ({ ok: false, error, violations });
