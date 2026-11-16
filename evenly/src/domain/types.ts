/** Plain data shapes shared by every domain module. Vocabulary: see /GLOSSARY.md. */

export type StaffId = string;
export type ShiftId = string;
/** Local calendar date, `YYYY-MM-DD`, in the Department's time zone. */
export type LocalDate = string;

export interface StaffMember {
  id: StaffId;
  name: string;
  clinicalRole: string;
  /** 0 < fte <= 1 */
  fte: number;
  tags: string[];
}

export interface Shift {
  id: ShiftId;
  shiftTypeId: string;
  label: string;
  date: LocalDate;
  /** Minutes after local midnight of `date`. */
  startMinute: number;
  /** Minutes after local midnight of `date`; may exceed 1440 for overnight Shifts. */
  endMinute: number;
  requiredTags: string[];
  headcount: number;
  weight: number;
  onCall: boolean;
}

export interface Assignment {
  shiftId: ShiftId;
  staffId: StaffId;
  locked?: boolean;
}

/** Approved time off, inclusive range. */
export interface TimeOff {
  staffId: StaffId;
  startDate: LocalDate;
  endDate: LocalDate;
}

export const PREFERENCE_KINDS = ["avoid", "want"] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

export interface Preference {
  staffId: StaffId;
  date: LocalDate;
  kind: PreferenceKind;
  /** When set, the Preference applies only to Shifts of this Shift Type on that date. */
  shiftTypeId?: string;
}

export interface ThresholdRule {
  enabled: boolean;
  hard: boolean;
  value: number;
}

/** Rest after Block: after at least `minBlockDays` consecutive working days, at least `daysOff` days off. */
export interface BlockRestRule {
  enabled: boolean;
  hard: boolean;
  minBlockDays: number;
  daysOff: number;
}

export interface RuleConfig {
  minRestHours: ThresholdRule;
  maxConsecutiveDays: ThresholdRule;
  maxShiftsPerWeek: ThresholdRule;
  /** Whether Preferences are honoured; always Soft. */
  preferences: { enabled: boolean };
  restAfterBlock: BlockRestRule;
  /** Auto-fill keeps a Staff Member on the same Shift Type on consecutive days (ADR-0009). */
  continuity: { enabled: boolean };
}

export const DEFAULT_RULES: RuleConfig = {
  minRestHours: { enabled: true, hard: true, value: 10 },
  maxConsecutiveDays: { enabled: true, hard: false, value: 5 },
  maxShiftsPerWeek: { enabled: true, hard: false, value: 5 },
  preferences: { enabled: true },
  restAfterBlock: { enabled: false, hard: true, minBlockDays: 7, daysOff: 7 },
  continuity: { enabled: false },
};

/** Rule settings as stored may predate newer Rules; missing ones take their defaults (off). */
export function withRuleDefaults(stored: Partial<RuleConfig> | null | undefined): RuleConfig {
  const out = { ...DEFAULT_RULES } as RuleConfig;
  for (const k of Object.keys(DEFAULT_RULES) as (keyof RuleConfig)[]) {
    const v = stored?.[k];
    if (v && typeof v === "object") (out as unknown as Record<string, unknown>)[k] = { ...DEFAULT_RULES[k], ...v };
  }
  return out;
}

/** A self-contained snapshot of everything the Rule engine needs to judge a schedule. */
export interface ScheduleContext {
  timeZone: string;
  staff: StaffMember[];
  shifts: Shift[];
  assignments: Assignment[];
  timeOff: TimeOff[];
  preferences: Preference[];
  rules: RuleConfig;
  /** Load already accrued before this range (e.g. previous periods), keyed by Staff Member. */
  priorLoad?: Record<StaffId, number>;
}

export type RuleKind =
  | "requiredTags"
  | "overlap"
  | "timeOff"
  | "minRest"
  | "maxConsecutiveDays"
  | "maxShiftsPerWeek"
  | "restAfterBlock"
  | "preference"
  | "headcount";

export interface Violation {
  rule: RuleKind;
  severity: "hard" | "soft";
  staffId: StaffId;
  shiftId: ShiftId;
  message: string;
  penalty: number;
}
