import { eachDate } from "./time";
import type { Assignment, LocalDate, Shift, StaffId, TimeOff } from "./types";

export type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";

export interface TimeOffRequest extends TimeOff {
  status: TimeOffStatus;
}

/**
 * Dates in `request` where approving it would exceed the Department's Request Limit,
 * counting other Staff Members' approved time off.
 */
export function requestLimitConflicts(request: TimeOff, existing: TimeOffRequest[], limit: number): LocalDate[] {
  if (limit <= 0) return [];
  return eachDate(request.startDate, request.endDate).filter((d) => {
    const others = new Set(
      existing.filter((r) => r.status === "approved" && r.staffId !== request.staffId && r.startDate <= d && d <= r.endDate).map((r) => r.staffId),
    );
    return others.size >= limit;
  });
}

/** The Staff Member's existing Assignments that approved time off would conflict with. */
export function conflictingAssignments(request: TimeOff, assignments: Assignment[], shifts: Shift[]): Assignment[] {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  return assignments.filter((a) => {
    const s = byId.get(a.shiftId);
    return a.staffId === request.staffId && !!s && request.startDate <= s.date && s.date <= request.endDate;
  });
}

export function validateRange(startDate: LocalDate, endDate: LocalDate): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return "Dates must be YYYY-MM-DD";
  if (endDate < startDate) return "End date is before start date";
  if (eachDate(startDate, endDate).length > 60) return "Requests are limited to 60 days";
  return null;
}

export type { StaffId };
