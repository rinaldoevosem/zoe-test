import { formatMinute } from "@/domain/time";

export function shortName(name: string): string {
  const clean = name.replace(/^Dr\.\s+/, "").replace(/,.*$/, "").trim();
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1] ?? clean;
}

export function timeRange(startMinute: number, endMinute: number): string {
  return `${formatMinute(startMinute)}–${formatMinute(endMinute)}${endMinute > 1440 ? " +1" : ""}`;
}

export function prettyDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function initials(name: string): string {
  return name.replace(/^Dr\.\s+/, "").replace(/,.*$/, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export const SHIFT_TYPE_COLORS = ["sky", "rose", "amber", "violet", "indigo", "emerald", "teal", "slate"] as const;
export type ShiftTypeColor = (typeof SHIFT_TYPE_COLORS)[number];

/** "4 published Assignments now break a Hard Rule" — one wording for toasts, audit and notifications. */
export function brokenAssignmentsPhrase(n: number): string {
  return `${n} published Assignment${n === 1 ? "" : "s"} now break${n === 1 ? "s" : ""} a Hard Rule`;
}

/** Static Tailwind classes per Shift Type color (listed literally so Tailwind generates them). */
export const SHIFT_COLORS: Record<ShiftTypeColor, string> = {
  sky: "bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/30",
  rose: "bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30",
  violet: "bg-violet-500/10 text-violet-800 dark:text-violet-200 border-violet-500/30",
  indigo: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 border-indigo-500/30",
  emerald: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  teal: "bg-teal-500/10 text-teal-800 dark:text-teal-200 border-teal-500/30",
  slate: "bg-slate-500/10 text-slate-800 dark:text-slate-200 border-slate-500/30",
};

export const shiftColor = (c: string) => SHIFT_COLORS[c as ShiftTypeColor] ?? SHIFT_COLORS.slate;
