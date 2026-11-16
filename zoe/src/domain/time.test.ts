import { describe, expect, test } from "vitest";
import { addDays, eachDate, localToInstant, shiftHours, weekStart, instantToLocalDate, formatMinute } from "./time";

describe("local time", () => {
  test("07:00 in New York on a winter day is 12:00Z", () => {
    expect(new Date(localToInstant("2026-01-15", 7 * 60, "America/New_York")).toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  test("an overnight 19:00→07:00 Shift lasts 11 hours on the spring-forward night", () => {
    expect(shiftHours({ date: "2026-03-07", startMinute: 19 * 60, endMinute: 31 * 60 }, "America/New_York")).toBe(11);
  });

  test("an overnight 19:00→07:00 Shift lasts 13 hours on the fall-back night", () => {
    expect(shiftHours({ date: "2026-10-31", startMinute: 19 * 60, endMinute: 31 * 60 }, "America/New_York")).toBe(13);
  });

  test("calendar helpers", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(eachDate("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(instantToLocalDate(Date.parse("2026-11-17T03:00:00Z"), "America/Chicago")).toBe("2026-11-16");
    expect(formatMinute(31 * 60)).toBe("07:00");
  });
});
