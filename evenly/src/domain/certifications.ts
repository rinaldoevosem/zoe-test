/**
 * Certifications: Tags with an expiry date. A Tag qualifies a Staff Member for Shifts up to and
 * including its expiry date (GLOSSARY: Certification).
 */
import { daysBetween } from "./time";
import type { LocalDate, StaffId, StaffMember } from "./types";

/** Whether the Staff Member holds `tag` on `date`: they have it, and it hasn't expired by then. */
export function holdsTag(member: StaffMember, tag: string, date: LocalDate): boolean {
  if (!member.tags.includes(tag)) return false;
  const expires = member.tagExpiry?.[tag];
  return !expires || date <= expires;
}

export interface ExpiringCertification {
  staffId: StaffId;
  tag: string;
  expires: LocalDate;
  /** Negative once expired. */
  daysLeft: number;
}

/** Certifications that expire within `withinDays` of `today` (or already have), soonest first. */
export function expiringCertifications(staff: StaffMember[], today: LocalDate, withinDays: number): ExpiringCertification[] {
  const out: ExpiringCertification[] = [];
  for (const m of staff) {
    for (const tag of m.tags) {
      const expires = m.tagExpiry?.[tag];
      if (!expires) continue;
      const daysLeft = daysBetween(today, expires);
      if (daysLeft <= withinDays) out.push({ staffId: m.id, tag, expires, daysLeft });
    }
  }
  return out.sort((a, b) => a.expires.localeCompare(b.expires) || a.staffId.localeCompare(b.staffId) || a.tag.localeCompare(b.tag));
}
