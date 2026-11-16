/**
 * Auto-fill (ADR-0002): fill Coverage Gaps only, never break a Hard Rule, never move a Locked
 * Assignment, equalise Load by FTE, minimise Penalty, and explain every pick. Deterministic.
 */
import { holdsTag } from "./certifications";
import { loadOf } from "./load";
import { checkAssignment, hasHard, matchesPreference, totalPenalty } from "./rules";
import { addDays, isWeekend } from "./time";
import type { Assignment, RuleKind, ScheduleContext, Shift, ShiftId, StaffId, StaffMember } from "./types";

export interface Candidate {
  staffId: StaffId;
  projectedLoad: number;
  penalty: number;
  /** The Staff Member has a "want" Preference for this Shift. Breaks ties only; never outweighs Load or Penalty. */
  wants: boolean;
  /** Holds the same Shift Type on the day before or after (Continuity, ADR-0009). */
  continues: boolean;
}

export interface Explanation {
  shiftId: ShiftId;
  staffId: StaffId;
  eligibleCount: number;
  summary: string;
  runnersUp: Candidate[];
}

export interface Unfilled {
  shiftId: ShiftId;
  missing: number;
  reasons: string[];
}

export interface AutofillResult {
  added: Assignment[];
  explanations: Explanation[];
  unfilled: Unfilled[];
}

const REASON_LABEL: Partial<Record<RuleKind, string>> = {
  requiredTags: "lack a required tag",
  timeOff: "on approved time off",
  overlap: "already working then",
  minRest: "would not get minimum rest",
  maxConsecutiveDays: "at consecutive-day limit",
  maxShiftsPerWeek: "at weekly limit",
  restAfterBlock: "resting after a Block",
};

export function autofill(input: ScheduleContext): AutofillResult {
  const ctx: ScheduleContext = { ...input, assignments: [...input.assignments] };
  const weightByStaff = new Map<StaffId, number>();
  const shiftsById = new Map(ctx.shifts.map((s) => [s.id, s]));
  for (const a of ctx.assignments) {
    weightByStaff.set(a.staffId, (weightByStaff.get(a.staffId) ?? 0) + (shiftsById.get(a.shiftId)?.weight ?? 0));
  }
  const staff = [...ctx.staff].sort((a, b) => a.id.localeCompare(b.id));
  const load = (m: StaffMember, extra = 0) => loadOf((weightByStaff.get(m.id) ?? 0) + extra, m.fte) + (ctx.priorLoad?.[m.id] ?? 0);

  // Most-constrained first: fewest Staff Members who could ever hold the Shift, then on-call, then weekends,
  // then chronological. With Continuity on, weekends don't jump the queue, so Blocks grow forwards in date order.
  const continuity = !!ctx.rules.continuity?.enabled;
  const scarcity = (s: Shift) => staff.filter((m) => s.requiredTags.every((t) => holdsTag(m, t, s.date))).length;
  const gaps = ctx.shifts
    .filter((s) => ctx.assignments.filter((a) => a.shiftId === s.id).length < s.headcount)
    .sort((a, b) =>
      scarcity(a) - scarcity(b) ||
      Number(b.onCall) - Number(a.onCall) ||
      (continuity ? 0 : Number(isWeekend(b.date)) - Number(isWeekend(a.date))) ||
      a.date.localeCompare(b.date) || a.startMinute - b.startMinute || a.id.localeCompare(b.id),
    );
  const holdsAdjacent = (m: StaffMember, s: Shift) => {
    const near = new Set([addDays(s.date, -1), addDays(s.date, 1)]);
    return ctx.assignments.some((a) => {
      if (a.staffId !== m.id) return false;
      const other = shiftsById.get(a.shiftId);
      return !!other && other.shiftTypeId === s.shiftTypeId && near.has(other.date);
    });
  };

  const added: Assignment[] = [];
  const explanations: Explanation[] = [];
  const unfilled: Unfilled[] = [];

  for (const s of gaps) {
    let need = s.headcount - ctx.assignments.filter((a) => a.shiftId === s.id).length;
    while (need > 0) {
      const rejections = new Map<RuleKind, number>();
      const eligible: Candidate[] = [];
      for (const m of staff) {
        const vs = checkAssignment(ctx, { shiftId: s.id, staffId: m.id });
        if (hasHard(vs)) {
          const first = vs.find((v) => v.severity === "hard")!.rule;
          rejections.set(first, (rejections.get(first) ?? 0) + 1);
          continue;
        }
        const wants = ctx.rules.preferences.enabled && ctx.preferences.some((p) => p.kind === "want" && matchesPreference(p, m.id, s));
        eligible.push({ staffId: m.id, projectedLoad: round(load(m, s.weight)), penalty: totalPenalty(vs), wants, continues: continuity && holdsAdjacent(m, s) && !vs.some((v) => BLOCK_LIMITS.has(v.rule)) });
      }
      if (!eligible.length) {
        unfilled.push({
          shiftId: s.id,
          missing: need,
          reasons: [...rejections].filter(([r]) => r !== "headcount").sort(([a], [b]) => order(a) - order(b))
            .map(([r, n]) => `${n} ${REASON_LABEL[r] ?? r}`),
        });
        break;
      }
      eligible.sort((a, b) => Number(b.continues) - Number(a.continues) || a.projectedLoad - b.projectedLoad || a.penalty - b.penalty || Number(b.wants) - Number(a.wants) || a.staffId.localeCompare(b.staffId));
      const [pick, ...rest] = eligible;
      const assignment = { shiftId: s.id, staffId: pick.staffId };
      ctx.assignments.push(assignment);
      added.push(assignment);
      weightByStaff.set(pick.staffId, (weightByStaff.get(pick.staffId) ?? 0) + s.weight);
      explanations.push({
        shiftId: s.id,
        staffId: pick.staffId,
        eligibleCount: eligible.length,
        summary:
          `Chosen from ${eligible.length} eligible: ` +
          (pick.continues ? `continues their Block (Load ${pick.projectedLoad})` : `lowest Load (${pick.projectedLoad})`) +
          (pick.penalty ? `, accepting ${pick.penalty} Penalty` : ", no rule warnings") +
          (pick.wants ? ", asked to work it" : "") +
          (rejections.size ? `; ${[...rejections.values()].reduce((x, y) => x + y, 0)} others excluded by Hard Rules` : ""),
        runnersUp: rest.slice(0, 2),
      });
      need--;
    }
  }

  return { added: sortAssignments(added, shiftsById), explanations, unfilled };
}

/** Continuing a Block never beats the Block's own limits, even when they are Soft. */
const BLOCK_LIMITS = new Set<RuleKind>(["maxConsecutiveDays", "restAfterBlock"]);
const RULE_ORDER: RuleKind[] = ["requiredTags", "timeOff", "overlap", "minRest", "maxConsecutiveDays", "restAfterBlock", "maxShiftsPerWeek", "headcount", "preference"];
const order = (r: RuleKind) => RULE_ORDER.indexOf(r);
const round = (n: number) => Math.round(n * 100) / 100;

function sortAssignments(list: Assignment[], shifts: Map<string, Shift>): Assignment[] {
  return [...list].sort((a, b) => {
    const sa = shifts.get(a.shiftId)!;
    const sb = shifts.get(b.shiftId)!;
    return sa.date.localeCompare(sb.date) || sa.startMinute - sb.startMinute || a.shiftId.localeCompare(b.shiftId) || a.staffId.localeCompare(b.staffId);
  });
}
