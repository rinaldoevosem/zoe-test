import { TZDate } from "@date-fns/tz";
import type { LocalDate, Shift } from "./types";

const MINUTES_PER_DAY = 24 * 60;

/** Adds whole days to a local calendar date. Pure calendar arithmetic: no time zone involved. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Inclusive list of local dates from start to end. */
export function eachDate(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(date: LocalDate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: LocalDate): LocalDate {
  const w = weekday(date);
  return addDays(date, w === 0 ? -6 : 1 - w);
}

/** The instant (epoch ms) at which local wall-clock `minute` after midnight of `date` occurs in `timeZone`. */
export function localToInstant(date: LocalDate, minute: number, timeZone: string): number {
  const dayOffset = Math.floor(minute / MINUTES_PER_DAY);
  const within = minute - dayOffset * MINUTES_PER_DAY;
  const [y, m, d] = addDays(date, dayOffset).split("-").map(Number);
  return new TZDate(y, m - 1, d, Math.floor(within / 60), within % 60, 0, 0, timeZone).getTime();
}

export interface Interval {
  start: number;
  end: number;
}

export function shiftInterval(shift: Pick<Shift, "date" | "startMinute" | "endMinute">, timeZone: string): Interval {
  return {
    start: localToInstant(shift.date, shift.startMinute, timeZone),
    end: localToInstant(shift.date, shift.endMinute, timeZone),
  };
}

/** Wall-clock hours of a Shift as experienced (DST-aware). */
export function shiftHours(shift: Pick<Shift, "date" | "startMinute" | "endMinute">, timeZone: string): number {
  const { start, end } = shiftInterval(shift, timeZone);
  return (end - start) / 3_600_000;
}

/** Local date (YYYY-MM-DD) of an instant in a time zone. */
export function instantToLocalDate(instant: number, timeZone: string): LocalDate {
  const t = new TZDate(instant, timeZone);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function formatMinute(minute: number): string {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Converts wall-clock "HH:MM" start/end into Shift minutes (ADR-0004). An end at or before the
 * start means the Shift ends the next day, so its endMinute exceeds 1440.
 */
export function wallClockRange(start: string, end: string): { startMinute: number; endMinute: number } {
  const toMinute = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const startMinute = toMinute(start);
  let endMinute = toMinute(end);
  if (endMinute <= startMinute) endMinute += 1440;
  return { startMinute, endMinute };
}

/** Whole days from `from` to `to` (local dates); negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms = (d: LocalDate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Minutes after local midnight of an instant in a time zone. */
export function instantToLocalMinute(instant: number, timeZone: string): number {
  const t = new TZDate(instant, timeZone);
  return t.getHours() * 60 + t.getMinutes();
}
