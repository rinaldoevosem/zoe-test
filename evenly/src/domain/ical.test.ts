import { describe, expect, test } from "vitest";
import { renderCalendar } from "./ical";

describe("Calendar Feed rendering", () => {
  const ics = renderCalendar(
    "Ana, MD",
    [{ uid: "a1@evenly", start: Date.parse("2026-01-05T12:00:00Z"), end: Date.parse("2026-01-05T22:00:00Z"), summary: "OR Day; Main", description: "Line one\nLine two" }],
    Date.parse("2026-01-01T00:00:00Z"),
  );

  test("renders a VEVENT in UTC with escaped text and CRLF line endings", () => {
    expect(ics.split("\r\n")).toEqual([
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Evenly//Clinical Scheduling//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:Ana\\, MD", "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M",
      "BEGIN:VEVENT", "UID:a1@evenly", "DTSTAMP:20260101T000000Z", "DTSTART:20260105T120000Z", "DTEND:20260105T220000Z",
      "SUMMARY:OR Day\; Main", "DESCRIPTION:Line one\\nLine two", "END:VEVENT", "END:VCALENDAR", "",
    ]);
  });

  test("folds lines longer than 75 octets", () => {
    const long = renderCalendar("x", [{ uid: "u", start: 0, end: 1, summary: "a".repeat(100) }], 0);
    const lines = long.split("\r\n");
    const i = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lines[i]).toHaveLength(75);
    expect(lines[i + 1]).toBe(" " + "a".repeat(33));
  });
});
