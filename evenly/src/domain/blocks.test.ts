import { describe, expect, test } from "vitest";
import { autofill } from "./autofill";
import { evaluate } from "./rules";
import { ctx, rulesOff, shift, staff } from "./testing/builders";
import { DEFAULT_RULES, withRuleDefaults, type Assignment } from "./types";

const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;
const run = (who: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ shiftId: `d${from + i}`, staffId: who }));
const fortnight = (first = 5, last = 18) =>
  Array.from({ length: last - first + 1 }, (_, i) => shift(`d${first + i}`, day(first + i), { shiftTypeId: "team1", label: "Day Team 1" }));

const blockRules = (over: { hard?: boolean; continuity?: boolean } = {}) =>
  rulesOff({
    maxConsecutiveDays: { enabled: true, hard: true, value: 7 },
    restAfterBlock: { enabled: true, hard: over.hard ?? true, minBlockDays: 7, daysOff: 5 },
    continuity: { enabled: over.continuity ?? true },
  });

describe("Rest after Block", () => {
  test("a Shift too soon after a 7-day Block is a Violation, judged Hard or Soft by the setting", () => {
    const shifts = [...fortnight(5, 11), shift("d14", day(14))];
    const assignments = [...run("ana", 5, 11), { shiftId: "d14", staffId: "ana" }];
    const hard = evaluate(ctx({ staff: [staff("ana")], shifts, assignments, rules: blockRules() }));
    expect(hard.map((v) => [v.rule, v.severity, v.shiftId])).toEqual([["restAfterBlock", "hard", "d14"]]);
    expect(hard[0].message).toBe("ana would get 2 days off after a 7-day Block (minimum 5)");
    const soft = evaluate(ctx({ staff: [staff("ana")], shifts, assignments, rules: blockRules({ hard: false }) }));
    expect(soft.map((v) => [v.rule, v.severity])).toEqual([["restAfterBlock", "soft"]]);
  });

  test("enough days off, or a run shorter than a Block, is fine", () => {
    const rested = [...fortnight(5, 11), shift("d17", day(17))];
    expect(evaluate(ctx({ staff: [staff("ana")], shifts: rested, assignments: [...run("ana", 5, 11), { shiftId: "d17", staffId: "ana" }], rules: blockRules() }))).toEqual([]);
    const short = [...fortnight(5, 8), shift("d10", day(10))];
    expect(evaluate(ctx({ staff: [staff("ana")], shifts: short, assignments: [...run("ana", 5, 8), { shiftId: "d10", staffId: "ana" }], rules: blockRules() }))).toEqual([]);
  });

  test("is off by default", () => {
    expect(DEFAULT_RULES.restAfterBlock.enabled).toBe(false);
    expect(DEFAULT_RULES.continuity.enabled).toBe(false);
  });
});

describe("Continuity in Auto-fill", () => {
  const blocksOf = (added: Assignment[]) => {
    const order = [...added].sort((a, b) => a.shiftId.localeCompare(b.shiftId, undefined, { numeric: true }));
    const out: [string, number][] = [];
    for (const a of order) {
      const last = out.at(-1);
      if (last && last[0] === a.staffId) last[1]++;
      else out.push([a.staffId, 1]);
    }
    return out;
  };

  test("keeps one person on a Shift Type for a whole Block, then hands over", () => {
    const { added, unfilled } = autofill(ctx({ staff: [staff("ana"), staff("bo")], shifts: fortnight(), rules: blockRules() }));
    expect(unfilled).toEqual([]);
    expect(blocksOf(added)).toEqual([["ana", 7], ["bo", 7]]);
  });

  test("without Continuity, Load balancing alternates people day by day", () => {
    const { added } = autofill(ctx({ staff: [staff("ana"), staff("bo")], shifts: fortnight(5, 8), rules: blockRules({ continuity: false }) }));
    expect(blocksOf(added).every(([, n]) => n === 1)).toBe(true);
  });

  test("the Explanation says the pick continues a Block", () => {
    const { explanations } = autofill(ctx({ staff: [staff("ana"), staff("bo")], shifts: fortnight(5, 7), rules: blockRules() }));
    expect(explanations[0].summary).not.toContain("continues their Block");
    expect(explanations[1].summary).toContain("continues their Block");
  });
});

describe("stored Rule settings", () => {
  test("settings saved before Blocks existed take the defaults for the new Rules", () => {
    const { restAfterBlock, continuity, ...old } = DEFAULT_RULES;
    void restAfterBlock; void continuity;
    const rules = withRuleDefaults({ ...old, minRestHours: { enabled: true, hard: false, value: 12 } });
    expect(rules.minRestHours.value).toBe(12);
    expect(rules.restAfterBlock).toEqual(DEFAULT_RULES.restAfterBlock);
    expect(rules.continuity).toEqual({ enabled: false });
  });
});
