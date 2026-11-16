import { describe, expect, test } from "vitest";
import { autofill } from "./autofill";
import { computeLoad, fairnessSummary } from "./load";
import { evaluate, hasHard } from "./rules";
import { ctx, rulesOff, shift, staff } from "./testing/builders";

const days = (n: number, from = 5) => Array.from({ length: n }, (_, i) => `2026-01-${String(from + i).padStart(2, "0")}`);

describe("Auto-fill", () => {
  test("fills every Coverage Gap when enough eligible staff exist", () => {
    const c = ctx({ staff: [staff("ana"), staff("bo")], shifts: days(4).map((d, i) => shift(`s${i}`, d)) });
    const result = autofill(c);
    expect(result.added).toHaveLength(4);
    expect(result.unfilled).toEqual([]);
  });

  test("equalises Load between equal-FTE staff", () => {
    const c = ctx({ staff: [staff("ana"), staff("bo")], shifts: days(4).map((d, i) => shift(`s${i}`, d)) });
    const { added } = autofill(c);
    const loads = computeLoad({ ...c, assignments: added }).map((r) => [r.staffId, r.shifts]);
    expect(loads).toEqual([["ana", 2], ["bo", 2]]);
  });

  test("a 0.5 FTE Staff Member gets half the Shifts of a 1.0 FTE colleague", () => {
    const c = ctx({ staff: [staff("full"), staff("half", { fte: 0.5 })], shifts: days(6).map((d, i) => shift(`s${i}`, d)) });
    const { added } = autofill(c);
    const count = (id: string) => added.filter((a) => a.staffId === id).length;
    expect([count("full"), count("half")]).toEqual([4, 2]);
  });

  test("never moves or duplicates a Locked Assignment and only fills gaps", () => {
    const c = ctx({
      staff: [staff("ana"), staff("bo")],
      shifts: [shift("s0", "2026-01-05"), shift("s1", "2026-01-06")],
      assignments: [{ shiftId: "s0", staffId: "ana", locked: true }],
    });
    expect(autofill(c).added).toEqual([{ shiftId: "s1", staffId: "bo" }]);
  });

  test("never produces a Hard Violation and reports why a Shift stayed unfilled", () => {
    const c = ctx({
      staff: [staff("ana", { tags: ["adult"] }), staff("bo", { tags: ["peds"] })],
      shifts: [shift("peds", "2026-01-05", { requiredTags: ["peds"] }), shift("cardiac", "2026-01-05", { requiredTags: ["cardiac"], startMinute: 18 * 60, endMinute: 22 * 60 })],
      timeOff: [{ staffId: "bo", startDate: "2026-01-05", endDate: "2026-01-05" }],
    });
    const result = autofill(c);
    expect(result.added).toEqual([]);
    expect(hasHard(evaluate({ ...c, assignments: result.added }))).toBe(false);
    const peds = result.unfilled.find((u) => u.shiftId === "peds")!;
    expect(peds.missing).toBe(1);
    expect(peds.reasons).toEqual(["1 lack a required tag", "1 on approved time off"]);
  });

  test("is deterministic", () => {
    const c = ctx({
      rules: rulesOff({ minRestHours: { enabled: true, hard: true, value: 10 } }),
      staff: ["d", "a", "c", "b"].map((id) => staff(id)),
      shifts: days(10).flatMap((d, i) => [shift(`d${i}`, d), shift(`n${i}`, d, { startMinute: 19 * 60, endMinute: 31 * 60 })]),
    });
    expect(autofill(c)).toEqual(autofill(c));
  });

  test("explains each pick with the runner-up", () => {
    const c = ctx({ staff: [staff("ana"), staff("bo")], shifts: [shift("s0", "2026-01-05")], priorLoad: { ana: 3 } });
    const { explanations } = autofill(c);
    expect(explanations).toHaveLength(1);
    expect(explanations[0]).toMatchObject({ shiftId: "s0", staffId: "bo", eligibleCount: 2 });
    expect(explanations[0].runnersUp[0].staffId).toBe("ana");
    expect(explanations[0].summary).toContain("lowest Load");
  });

  test("prefers a candidate without Soft Violations when Load is tied", () => {
    const c = ctx({
      rules: rulesOff({ preferences: { enabled: true } }),
      staff: [staff("ana"), staff("bo")],
      shifts: [shift("s0", "2026-01-05")],
      preferences: [{ staffId: "ana", date: "2026-01-05", kind: "avoid" }],
    });
    expect(autofill(c).added).toEqual([{ shiftId: "s0", staffId: "bo" }]);
  });

  test("a 'want' Preference wins a Load tie and the Explanation says so", () => {
    const c = ctx({
      rules: rulesOff({ preferences: { enabled: true } }),
      staff: [staff("ana"), staff("bo")],
      shifts: [shift("s0", "2026-01-05", { shiftTypeId: "call" })],
      preferences: [{ staffId: "bo", date: "2026-01-05", kind: "want", shiftTypeId: "call" }],
    });
    const r = autofill(c);
    expect(r.added).toEqual([{ shiftId: "s0", staffId: "bo" }]);
    expect(r.explanations[0].summary).toContain("asked to work");
  });

  test("a 'want' Preference never outweighs a lower Load", () => {
    const c = ctx({
      rules: rulesOff({ preferences: { enabled: true } }),
      staff: [staff("ana"), staff("bo")],
      shifts: [shift("s0", "2026-01-05")],
      preferences: [{ staffId: "bo", date: "2026-01-05", kind: "want" }],
      priorLoad: { bo: 2 },
    });
    expect(autofill(c).added).toEqual([{ shiftId: "s0", staffId: "ana" }]);
  });

  test("fills the most constrained Shift first so a scarce specialist is not used up elsewhere", () => {
    const c = ctx({
      staff: [staff("generalist"), staff("peds", { tags: ["peds"] })],
      shifts: [
        shift("a-general", "2026-01-05"),
        shift("b-peds", "2026-01-05", { requiredTags: ["peds"] }),
      ],
    });
    const { added } = autofill(c);
    expect(added).toContainEqual({ shiftId: "b-peds", staffId: "peds" });
    expect(added).toContainEqual({ shiftId: "a-general", staffId: "generalist" });
  });
});

describe("Fairness summary", () => {
  const row = (staffId: string, load: number) => ({ staffId, name: staffId, fte: 1, shifts: 0, hours: 0, weekendShifts: 0, onCallShifts: 0, weight: 0, load });

  test("reports average Load, spread, and calls a spread within 25% of the average equitable", () => {
    expect(fairnessSummary([row("a", 20), row("b", 22), row("c", 24)])).toEqual({ averageLoad: 22, spread: 4, relativeSpread: 0.18, equitable: true });
  });

  test("a wide spread is not equitable; staff with no FTE are ignored", () => {
    expect(fairnessSummary([row("a", 10), row("b", 20), row("x", Number.POSITIVE_INFINITY)])).toEqual({ averageLoad: 15, spread: 10, relativeSpread: 0.67, equitable: false });
  });

  test("an empty department is trivially equitable", () => {
    expect(fairnessSummary([])).toEqual({ averageLoad: 0, spread: 0, relativeSpread: 0, equitable: true });
  });
});

describe("Load", () => {
  test("weights Shifts, divides by FTE and counts weekends, nights on call and hours", () => {
    const c = ctx({
      staff: [staff("ana", { fte: 0.5 })],
      shifts: [
        shift("sat-call", "2026-01-10", { weight: 2, onCall: true, startMinute: 7 * 60, endMinute: 31 * 60 }),
        shift("mon", "2026-01-12"),
      ],
      assignments: [{ shiftId: "sat-call", staffId: "ana" }, { shiftId: "mon", staffId: "ana" }],
    });
    expect(computeLoad(c)).toEqual([
      { staffId: "ana", name: "ana", fte: 0.5, shifts: 2, hours: 34, weekendShifts: 1, onCallShifts: 1, weight: 3, load: 6 },
    ]);
  });
});
