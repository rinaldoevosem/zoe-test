import { describe, expect, test } from "vitest";
import { conflictingAssignments, requestLimitConflicts, validateRange } from "./timeoff";
import { shift } from "./testing/builders";

describe("Time-Off Requests", () => {
  const approved = [
    { staffId: "bo", startDate: "2026-07-01", endDate: "2026-07-03", status: "approved" as const },
    { staffId: "cy", startDate: "2026-07-03", endDate: "2026-07-05", status: "approved" as const },
    { staffId: "di", startDate: "2026-07-01", endDate: "2026-07-10", status: "pending" as const },
  ];

  test("reports the dates already at the Request Limit, ignoring pending requests", () => {
    expect(requestLimitConflicts({ staffId: "ana", startDate: "2026-07-02", endDate: "2026-07-04" }, approved, 2)).toEqual(["2026-07-03"]);
  });

  test("a limit of 0 means unlimited", () => {
    expect(requestLimitConflicts({ staffId: "ana", startDate: "2026-07-01", endDate: "2026-07-05" }, approved, 0)).toEqual([]);
  });

  test("lists the requester's Assignments inside the range", () => {
    const shifts = [shift("in", "2026-07-02"), shift("out", "2026-07-09")];
    const assignments = [{ shiftId: "in", staffId: "ana" }, { shiftId: "out", staffId: "ana" }, { shiftId: "in", staffId: "bo" }];
    expect(conflictingAssignments({ staffId: "ana", startDate: "2026-07-01", endDate: "2026-07-03" }, assignments, shifts)).toEqual([{ shiftId: "in", staffId: "ana" }]);
  });

  test("rejects reversed or overlong ranges", () => {
    expect(validateRange("2026-07-05", "2026-07-01")).toBe("End date is before start date");
    expect(validateRange("2026-01-01", "2026-12-31")).toBe("Requests are limited to 60 days");
    expect(validateRange("2026-07-01", "2026-07-01")).toBeNull();
  });
});
