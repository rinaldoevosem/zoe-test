import { describe, expect, test } from "vitest";
import { checkAssignment, checkCandidate, evaluate } from "./rules";
import { ctx, rulesOff, shift, staff } from "./testing/builders";

const summary = (vs: { rule: string; severity: string; staffId: string; shiftId: string }[]) =>
  vs.map((v) => `${v.severity}:${v.rule}:${v.staffId}@${v.shiftId}`);

describe("Rule engine", () => {
  test("a clean schedule has no Violations", () => {
    const c = ctx({ staff: [staff("ana")], shifts: [shift("s1", "2026-01-05")], assignments: [{ shiftId: "s1", staffId: "ana" }] });
    expect(evaluate(c)).toEqual([]);
  });

  test("assigning a Staff Member without a required Tag is a Hard Violation that names the missing Tag", () => {
    const c = ctx({ staff: [staff("ana", { tags: ["adult"] })], shifts: [shift("s1", "2026-01-05", { requiredTags: ["peds"] })] });
    const [v] = checkAssignment(c, { shiftId: "s1", staffId: "ana" });
    expect(v).toMatchObject({ rule: "requiredTags", severity: "hard" });
    expect(v.message).toContain("peds");
  });

  test("overlapping Shifts for one Staff Member are a Hard Violation", () => {
    const c = ctx({
      staff: [staff("ana")],
      shifts: [shift("day", "2026-01-05"), shift("eve", "2026-01-05", { startMinute: 15 * 60, endMinute: 23 * 60 })],
      assignments: [{ shiftId: "day", staffId: "ana" }],
    });
    expect(summary(checkAssignment(c, { shiftId: "eve", staffId: "ana" }))).toEqual(["hard:overlap:ana@eve"]);
  });

  test("approved time off covering the Shift date is a Hard Violation", () => {
    const c = ctx({
      staff: [staff("ana")],
      shifts: [shift("s1", "2026-01-07")],
      timeOff: [{ staffId: "ana", startDate: "2026-01-06", endDate: "2026-01-08" }],
    });
    expect(summary(checkAssignment(c, { shiftId: "s1", staffId: "ana" }))).toEqual(["hard:timeOff:ana@s1"]);
  });

  test("less rest than the minimum between a night and the next day is reported with the actual hours", () => {
    const c = ctx({
      rules: rulesOff({ minRestHours: { enabled: true, hard: true, value: 10 } }),
      staff: [staff("ana")],
      shifts: [
        shift("night", "2026-01-05", { startMinute: 19 * 60, endMinute: 31 * 60 }),
        shift("day", "2026-01-06", { startMinute: 13 * 60, endMinute: 20 * 60 }),
      ],
      assignments: [{ shiftId: "night", staffId: "ana" }],
    });
    const [v] = checkAssignment(c, { shiftId: "day", staffId: "ana" });
    expect(v).toMatchObject({ rule: "minRest", severity: "hard", shiftId: "day" });
    expect(v.message).toContain("6h rest");
  });

  test("rest is measured on real instants across the spring-forward night", () => {
    // 19:00 Mar 7 → 07:00 Mar 8 is 11h; next shift 17:00 Mar 8 gives exactly 10h rest: allowed.
    const c = ctx({
      rules: rulesOff({ minRestHours: { enabled: true, hard: true, value: 10 } }),
      staff: [staff("ana")],
      shifts: [
        shift("night", "2026-03-07", { startMinute: 19 * 60, endMinute: 31 * 60 }),
        shift("eve", "2026-03-08", { startMinute: 17 * 60, endMinute: 23 * 60 }),
      ],
      assignments: [{ shiftId: "night", staffId: "ana" }],
    });
    expect(checkAssignment(c, { shiftId: "eve", staffId: "ana" })).toEqual([]);
  });

  test("working more consecutive days than allowed is a Soft Violation on the day that breaks the run", () => {
    const days = ["2026-01-05", "2026-01-06", "2026-01-07"];
    const c = ctx({
      rules: rulesOff({ maxConsecutiveDays: { enabled: true, hard: false, value: 2 } }),
      staff: [staff("ana")],
      shifts: days.map((d, i) => shift(`s${i}`, d)),
      assignments: days.map((_, i) => ({ shiftId: `s${i}`, staffId: "ana" })),
    });
    expect(summary(evaluate(c))).toEqual(["soft:maxConsecutiveDays:ana@s2"]);
  });

  test("exceeding the weekly maximum is reported once per extra Shift in that week", () => {
    const days = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-12"];
    const c = ctx({
      rules: rulesOff({ maxShiftsPerWeek: { enabled: true, hard: true, value: 2 } }),
      staff: [staff("ana")],
      shifts: days.map((d, i) => shift(`s${i}`, d)),
      assignments: days.map((_, i) => ({ shiftId: `s${i}`, staffId: "ana" })),
    });
    expect(summary(evaluate(c))).toEqual(["hard:maxShiftsPerWeek:ana@s2"]);
  });

  test("an 'avoid' Preference is a Soft Violation with a Penalty", () => {
    const c = ctx({
      rules: rulesOff({ preferences: { enabled: true } }),
      staff: [staff("ana")],
      shifts: [shift("s1", "2026-01-05")],
      preferences: [{ staffId: "ana", date: "2026-01-05", kind: "avoid" }],
    });
    const [v] = checkAssignment(c, { shiftId: "s1", staffId: "ana" });
    expect(v).toMatchObject({ rule: "preference", severity: "soft" });
    expect(v.penalty).toBeGreaterThan(0);
  });

  test("more Assignments than headcount is a Hard Violation", () => {
    const c = ctx({
      staff: [staff("ana"), staff("bo")],
      shifts: [shift("s1", "2026-01-05")],
      assignments: [{ shiftId: "s1", staffId: "ana" }],
    });
    expect(summary(checkAssignment(c, { shiftId: "s1", staffId: "bo" }))).toEqual(["hard:headcount:bo@s1"]);
  });

  test("checkCandidate judges the person, not whether the Shift is already full", () => {
    const c = ctx({
      staff: [staff("ana"), staff("bo", { tags: [] })],
      shifts: [shift("s1", "2026-01-05", { requiredTags: [] })],
      assignments: [{ shiftId: "s1", staffId: "ana" }],
    });
    expect(checkCandidate(c, { shiftId: "s1", staffId: "bo" })).toEqual([]);
  });

  test("checkAssignment reports only Violations the new Assignment introduces", () => {
    const c = ctx({
      staff: [staff("ana", { tags: [] }), staff("bo")],
      shifts: [shift("s1", "2026-01-05", { requiredTags: ["peds"] }), shift("s2", "2026-01-06")],
      assignments: [{ shiftId: "s1", staffId: "ana" }],
    });
    expect(evaluate(c)).toHaveLength(1);
    expect(checkAssignment(c, { shiftId: "s2", staffId: "bo" })).toEqual([]);
  });
});
