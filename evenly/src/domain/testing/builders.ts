import { DEFAULT_RULES, type RuleConfig, type ScheduleContext, type Shift, type StaffMember } from "../types";

/** Test data builders. Kept tiny so tests state only what matters to them. */
export function staff(id: string, over: Partial<StaffMember> = {}): StaffMember {
  return { id, name: id, clinicalRole: "physician", fte: 1, tags: [], ...over };
}

export function shift(id: string, date: string, over: Partial<Shift> = {}): Shift {
  return {
    id,
    shiftTypeId: over.shiftTypeId ?? "day",
    label: over.label ?? "Day",
    date,
    startMinute: 7 * 60,
    endMinute: 17 * 60,
    requiredTags: [],
    headcount: 1,
    weight: 1,
    onCall: false,
    ...over,
  };
}

export function rulesOff(over: Partial<RuleConfig> = {}): RuleConfig {
  return {
    minRestHours: { ...DEFAULT_RULES.minRestHours, enabled: false },
    maxConsecutiveDays: { ...DEFAULT_RULES.maxConsecutiveDays, enabled: false },
    maxShiftsPerWeek: { ...DEFAULT_RULES.maxShiftsPerWeek, enabled: false },
    preferences: { enabled: false },
    restAfterBlock: { ...DEFAULT_RULES.restAfterBlock, enabled: false },
    continuity: { enabled: false },
    ...over,
  };
}

export function ctx(over: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    timeZone: "America/New_York",
    staff: [],
    shifts: [],
    assignments: [],
    timeOff: [],
    preferences: [],
    rules: rulesOff(),
    ...over,
  };
}
