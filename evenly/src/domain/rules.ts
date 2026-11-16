/**
 * The Rule engine: the single judge of every schedule write (ADR-0002).
 *
 * Interface:
 *   evaluate(ctx)                      → every Violation in the snapshot
 *   checkAssignment(ctx, assignment)   → Violations the Assignment would newly introduce
 *   newViolations(before, after)       → Violations present in `after` but not in `before`
 */
import { holdsTag } from "./certifications";
import { addDays, daysBetween, shiftInterval, weekStart } from "./time";
import type { Assignment, Preference, ScheduleContext, Shift, StaffId, Violation } from "./types";

const SOFT_PENALTY = { maxConsecutiveDays: 5, maxShiftsPerWeek: 5, minRest: 8, restAfterBlock: 8, preference: 3 } as const;
const HARD_PENALTY = 1000;

export function evaluate(ctx: ScheduleContext): Violation[] {
  const shiftsById = new Map(ctx.shifts.map((s) => [s.id, s]));
  const out: Violation[] = [];
  const byStaff = new Map<StaffId, Shift[]>();
  for (const a of ctx.assignments) {
    const s = shiftsById.get(a.shiftId);
    if (!s) continue;
    const list = byStaff.get(a.staffId) ?? [];
    list.push(s);
    byStaff.set(a.staffId, list);
  }
  for (const member of [...ctx.staff].sort((a, b) => a.id.localeCompare(b.id))) {
    out.push(...evaluateStaff(ctx, member.id, byStaff.get(member.id) ?? []));
  }
  out.push(...evaluateHeadcount(ctx, shiftsById));
  return out;
}

export function checkAssignment(ctx: ScheduleContext, assignment: Assignment): Violation[] {
  const before = relevant(ctx, assignment);
  const after = relevant({ ...ctx, assignments: [...ctx.assignments, assignment] }, assignment);
  return newViolations(before, after);
}

/**
 * Violations a Staff Member would bring to a Shift on their own account, ignoring whether the Shift
 * is already full (headcount is about the Shift, not the person). Used to rank replacements.
 */
export function checkCandidate(ctx: ScheduleContext, assignment: Assignment): Violation[] {
  return checkAssignment(ctx, assignment).filter((v) => v.rule !== "headcount");
}

/** Violations in `after` whose identity (rule, staff, shift) was not already in `before`. */
export function newViolations(before: Violation[], after: Violation[]): Violation[] {
  const seen = new Set(before.map(key));
  return after.filter((v) => !seen.has(key(v)));
}

export function hasHard(vs: Violation[]): boolean {
  return vs.some((v) => v.severity === "hard");
}

export function totalPenalty(vs: Violation[]): number {
  return vs.reduce((sum, v) => sum + v.penalty, 0);
}

const key = (v: Violation) => `${v.rule}|${v.staffId}|${v.shiftId}`;

/** Only the Staff Member and Shift touched by `a` can gain Violations from it. */
function relevant(ctx: ScheduleContext, a: Assignment): Violation[] {
  const shiftsById = new Map(ctx.shifts.map((s) => [s.id, s]));
  const mine = ctx.assignments.filter((x) => x.staffId === a.staffId).map((x) => shiftsById.get(x.shiftId)).filter((s): s is Shift => !!s);
  return [
    ...evaluateStaff(ctx, a.staffId, mine),
    ...evaluateHeadcount({ ...ctx, shifts: ctx.shifts.filter((s) => s.id === a.shiftId) }, shiftsById),
  ];
}

function evaluateHeadcount(ctx: ScheduleContext, shiftsById: Map<string, Shift>): Violation[] {
  const out: Violation[] = [];
  for (const s of ctx.shifts) {
    const assigned = ctx.assignments.filter((a) => a.shiftId === s.id);
    if (assigned.length <= s.headcount) continue;
    for (const extra of assigned.slice(s.headcount)) {
      out.push({
        rule: "headcount",
        severity: "hard",
        staffId: extra.staffId,
        shiftId: s.id,
        message: `${shiftsById.get(s.id)?.label ?? "Shift"} on ${s.date} needs ${s.headcount}, would have ${assigned.length}`,
        penalty: HARD_PENALTY,
      });
    }
  }
  return out;
}

function evaluateStaff(ctx: ScheduleContext, staffId: StaffId, shifts: Shift[]): Violation[] {
  const member = ctx.staff.find((m) => m.id === staffId);
  if (!member) return [];
  const out: Violation[] = [];
  const timed = shifts
    .map((s) => ({ s, ...shiftInterval(s, ctx.timeZone) }))
    .sort((a, b) => a.start - b.start || a.s.id.localeCompare(b.s.id));

  for (const { s } of timed) {
    const missing = s.requiredTags.filter((t) => !member.tags.includes(t));
    const expired = s.requiredTags.filter((t) => member.tags.includes(t) && !holdsTag(member, t, s.date));
    if (missing.length) {
      out.push(v("requiredTags", "hard", staffId, s, `${member.name} lacks required tag${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`));
    } else if (expired.length) {
      out.push(v("requiredTags", "hard", staffId, s,
        expired.map((t) => `${member.name}'s ${t} Certification expired on ${member.tagExpiry![t]}`).join("; ")));
    }
    const off = ctx.timeOff.find((t) => t.staffId === staffId && t.startDate <= s.date && s.date <= t.endDate);
    if (off) out.push(v("timeOff", "hard", staffId, s, `${member.name} has approved time off ${off.startDate} – ${off.endDate}`));
    if (ctx.rules.preferences.enabled) {
      const pref = ctx.preferences.find((p) => p.kind === "avoid" && matchesPreference(p, staffId, s));
      if (pref) {
        const what = pref.shiftTypeId ? `${s.label} on ${s.date}` : s.date;
        out.push(v("preference", "soft", staffId, s, `${member.name} asked not to work ${what}`, SOFT_PENALTY.preference));
      }
    }
  }

  // Pairwise: overlap and rest, attributed to the later Shift.
  const rest = ctx.rules.minRestHours;
  for (let i = 1; i < timed.length; i++) {
    const cur = timed[i];
    const prevEnd = Math.max(...timed.slice(0, i).map((t) => t.end));
    const prev = timed.slice(0, i).find((t) => t.end === prevEnd)!;
    if (cur.start < prevEnd) {
      out.push(v("overlap", "hard", staffId, cur.s, `${member.name} is already on ${prev.s.label} ${prev.s.date}`));
      continue;
    }
    const gapHours = (cur.start - prevEnd) / 3_600_000;
    if (rest.enabled && gapHours < rest.value) {
      out.push(
        v("minRest", rest.hard ? "hard" : "soft", staffId, cur.s,
          `${member.name} would get ${round(gapHours)}h rest after ${prev.s.label} ${prev.s.date} (minimum ${rest.value}h)`,
          SOFT_PENALTY.minRest),
      );
    }
  }

  const consec = ctx.rules.maxConsecutiveDays;
  if (consec.enabled) {
    const dates = [...new Set(shifts.map((s) => s.date))].sort();
    let run = 0;
    let prevDate = "";
    for (const d of dates) {
      run = prevDate && addDays(prevDate, 1) === d ? run + 1 : 1;
      prevDate = d;
      if (run > consec.value) {
        const s = timed.find((t) => t.s.date === d)!.s;
        out.push(v("maxConsecutiveDays", consec.hard ? "hard" : "soft", staffId, s,
          `${member.name} would work ${run} days in a row (maximum ${consec.value})`, SOFT_PENALTY.maxConsecutiveDays));
      }
    }
  }

  const block = ctx.rules.restAfterBlock;
  if (block?.enabled) {
    const dates = [...new Set(shifts.map((s) => s.date))].sort();
    let runLength = 0;
    for (let i = 0; i < dates.length; i++) {
      runLength = i > 0 && addDays(dates[i - 1], 1) === dates[i] ? runLength + 1 : 1;
      const next = dates[i + 1];
      if (!next || addDays(dates[i], 1) === next || runLength < block.minBlockDays) continue;
      const off = daysBetween(dates[i], next) - 1;
      if (off < block.daysOff) {
        const s = timed.find((t) => t.s.date === next)!.s;
        out.push(v("restAfterBlock", block.hard ? "hard" : "soft", staffId, s,
          `${member.name} would get ${off} day${off === 1 ? "" : "s"} off after a ${runLength}-day Block (minimum ${block.daysOff})`, SOFT_PENALTY.restAfterBlock));
      }
    }
  }

  const weekly = ctx.rules.maxShiftsPerWeek;
  if (weekly.enabled) {
    const byWeek = new Map<string, Shift[]>();
    for (const { s } of timed) {
      const w = weekStart(s.date);
      byWeek.set(w, [...(byWeek.get(w) ?? []), s]);
    }
    for (const [w, list] of byWeek) {
      for (const s of list.slice(weekly.value)) {
        out.push(v("maxShiftsPerWeek", weekly.hard ? "hard" : "soft", staffId, s,
          `${member.name} would have ${list.length} shifts in week of ${w} (maximum ${weekly.value})`, SOFT_PENALTY.maxShiftsPerWeek));
      }
    }
  }
  return out;
}

/** Whether a Preference covers this Staff Member on this Shift (date, and Shift Type when the Preference names one). */
export function matchesPreference(p: Preference, staffId: StaffId, s: Shift): boolean {
  return p.staffId === staffId && p.date === s.date && (!p.shiftTypeId || p.shiftTypeId === s.shiftTypeId);
}

function v(rule: Violation["rule"], severity: Violation["severity"], staffId: StaffId, s: Shift, message: string, softPenalty = 0): Violation {
  return { rule, severity, staffId, shiftId: s.id, message, penalty: severity === "hard" ? HARD_PENALTY : softPenalty };
}

const round = (n: number) => Math.round(n * 10) / 10;
