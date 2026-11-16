import { describe, expect, test } from "vitest";
import { openTrade, transition, type Trade } from "./trades";
import { ctx, shift, staff } from "./testing/builders";

const base = ctx({
  staff: [staff("ana", { tags: ["peds"] }), staff("bo", { tags: ["peds"] }), staff("cy")],
  shifts: [shift("mon", "2026-01-05", { requiredTags: ["peds"] }), shift("tue", "2026-01-06"), shift("wed", "2026-01-07")],
  assignments: [{ shiftId: "mon", staffId: "ana" }, { shiftId: "tue", staffId: "bo" }],
});

const swap: Omit<Trade, "status"> = { kind: "swap", requesterId: "ana", shiftId: "mon", counterpartyId: "bo", counterpartyShiftId: "tue" };

describe("Trade Requests", () => {
  test("a rule-clean Swap is approved automatically when the counterparty accepts", () => {
    const opened = openTrade(swap, base, "auto");
    expect(opened.ok && opened.trade.status).toBe("open");
    const accepted = transition((opened as { trade: Trade }).trade, { type: "accept", by: "bo" }, base, "auto");
    expect(accepted).toMatchObject({
      ok: true,
      trade: { status: "approved" },
      apply: {
        remove: [{ shiftId: "mon", staffId: "ana" }, { shiftId: "tue", staffId: "bo" }],
        add: [{ shiftId: "mon", staffId: "bo" }, { shiftId: "tue", staffId: "ana" }],
      },
    });
  });

  test("with a manual policy an accepted Swap waits for a scheduler and applies on approve", () => {
    const accepted = transition({ ...swap, status: "open" }, { type: "accept", by: "bo" }, base, "manual");
    expect(accepted.ok && accepted.trade.status).toBe("accepted");
    expect(accepted.ok && accepted.apply).toBeUndefined();
    const approved = transition((accepted as { trade: Trade }).trade, { type: "approve" }, base, "manual");
    expect(approved.ok && approved.trade.status).toBe("approved");
    expect(approved.ok && approved.apply?.add).toHaveLength(2);
  });

  test("a Swap that would break a Hard Rule can't be opened and names the Violation", () => {
    const res = openTrade({ ...swap, counterpartyId: "cy", counterpartyShiftId: "wed" }, { ...base, assignments: [...base.assignments, { shiftId: "wed", staffId: "cy" }] }, "auto");
    expect(res.ok).toBe(false);
    expect(!res.ok && res.violations.map((v) => v.rule)).toEqual(["requiredTags"]);
  });

  test("a Giveaway can be picked up by any eligible colleague, but not by an ineligible one", () => {
    const giveaway: Trade = { kind: "giveaway", status: "open", requesterId: "ana", shiftId: "mon" };
    expect(transition(giveaway, { type: "accept", by: "cy" }, base, "auto").ok).toBe(false);
    expect(transition(giveaway, { type: "accept", by: "bo" }, base, "auto")).toMatchObject({
      ok: true,
      trade: { status: "approved", counterpartyId: "bo" },
      apply: { remove: [{ shiftId: "mon", staffId: "ana" }], add: [{ shiftId: "mon", staffId: "bo" }] },
    });
  });

  test("picking up a Coverage Gap assigns immediately when rule-clean", () => {
    expect(openTrade({ kind: "pickup", requesterId: "cy", shiftId: "wed" }, base, "auto")).toMatchObject({
      ok: true,
      trade: { status: "approved" },
      apply: { add: [{ shiftId: "wed", staffId: "cy" }] },
    });
  });

  test("a covered Shift can't be picked up", () => {
    expect(openTrade({ kind: "pickup", requesterId: "cy", shiftId: "tue" }, base, "auto")).toMatchObject({ ok: false, error: "This Shift is already covered" });
  });

  test("a Swap where either person is already on the other's Shift is refused", () => {
    const both = { ...base, shifts: [...base.shifts, shift("or", "2026-01-08", { headcount: 2 })], assignments: [...base.assignments, { shiftId: "or", staffId: "ana" }, { shiftId: "or", staffId: "bo" }] };
    expect(openTrade({ ...swap, shiftId: "or", counterpartyShiftId: "or" }, both, "auto")).toMatchObject({ ok: false, error: "You're both already on that Shift" });
    expect(openTrade({ ...swap, shiftId: "or", counterpartyShiftId: "tue" }, both, "auto")).toMatchObject({ ok: false, error: "bo is already on that Shift" });
  });

  test("you can only trade your own Assignment", () => {
    expect(openTrade({ ...swap, requesterId: "cy" }, base, "auto").ok).toBe(false);
  });

  test("only the colleague asked can accept or decline a Swap; only the requester can withdraw", () => {
    const open: Trade = { ...swap, status: "open" };
    expect(transition(open, { type: "accept", by: "cy" }, base, "auto").ok).toBe(false);
    expect(transition(open, { type: "decline", by: "cy" }, base, "auto").ok).toBe(false);
    expect(transition(open, { type: "decline", by: "bo" }, base, "auto")).toMatchObject({ ok: true, trade: { status: "declined" } });
    expect(transition(open, { type: "withdraw", by: "bo" }, base, "auto").ok).toBe(false);
    expect(transition(open, { type: "withdraw", by: "ana" }, base, "auto")).toMatchObject({ ok: true, trade: { status: "withdrawn" } });
  });

  test("a trade whose Assignment changed since it was offered can't be accepted", () => {
    const moved = { ...base, assignments: [{ shiftId: "tue", staffId: "bo" }] };
    expect(transition({ ...swap, status: "open" }, { type: "accept", by: "bo" }, moved, "auto")).toMatchObject({ ok: false });
  });
});
