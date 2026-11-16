/**
 * The daily job (beta ticket 07): Certification reminders, Urgent alerts for uncovered on-call Shifts in the next
 * 24 hours, and sending email and text Deliveries held by Quiet Hours. Safe to run more than once a day: every
 * reminder and alert carries a dedupe key, so each goes out once.
 */
import { and, eq } from "drizzle-orm";
import { expiringCertifications } from "@/domain/certifications";
import { addDays, formatMinute, instantToLocalDate, shiftInterval } from "@/domain/time";
import { schema, type DB } from "../db";
import { loadSnapshot } from "../repo";
import { notify, notifySchedulers } from "./common";
import { dispatchDue, type Senders } from "./delivery";

export const REMINDER_DAYS = 30;

type Department = typeof schema.departments.$inferSelect;

export async function runDailyJob(db: DB, now: number, senders?: Senders) {
  const summary = { reminders: 0, expired: 0, urgentGaps: 0, failedDepartments: [] as string[], deliveries: { sent: 0, skipped: 0, failed: 0 } };
  for (const dept of await db.select().from(schema.departments)) {
    // One Department's failure must not stop reminders and alerts for everyone else.
    try {
      const r = await runForDepartment(db, dept, now);
      summary.reminders += r.reminders; summary.expired += r.expired; summary.urgentGaps += r.urgentGaps;
    } catch (e) {
      console.error(`daily job failed for department ${dept.id}`, e);
      summary.failedDepartments.push(dept.id);
    }
  }
  summary.deliveries = await dispatchDue(db, now, senders);
  return summary;
}

async function runForDepartment(db: DB, dept: Department, now: number) {
  const summary = { reminders: 0, expired: 0, urgentGaps: 0 };
  {
    const today = instantToLocalDate(now, dept.timeZone);
    const target = { organizationId: dept.organizationId, departmentId: dept.id };
    const staff = await db.select().from(schema.staffMembers)
      .where(and(eq(schema.staffMembers.organizationId, dept.organizationId), eq(schema.staffMembers.departmentId, dept.id)));
    const names = new Map(staff.map((s) => [s.id, s.name]));

    for (const c of expiringCertifications(staff.filter((s) => s.active), today, REMINDER_DAYS)) {
      if (c.daysLeft >= 0) {
        summary.reminders += Math.sign(await notify(db, dept.organizationId, [c.staffId], {
          category: "reminder",
          title: `Your ${c.tag} Certification expires on ${c.expires}`,
          body: `Renew it before then; after ${c.expires} you can't be scheduled for Shifts that need ${c.tag}.`,
          href: "/settings",
          dedupeKey: `cert:${c.staffId}:${c.tag}:${c.expires}`,
        }));
      } else {
        summary.expired += Math.sign(await notifySchedulers(db, target, {
          category: "reminder",
          title: `${names.get(c.staffId)}'s ${c.tag} Certification has expired`,
          body: `It expired on ${c.expires}. They can't be scheduled for Shifts that need ${c.tag} until it's renewed.`,
          href: "/settings",
          dedupeKey: `cert-expired:${c.staffId}:${c.tag}:${c.expires}`,
        }));
      }
    }

    summary.urgentGaps += await alertUrgentGaps(db, dept, now);
  }
  return summary;
}

/**
 * Urgent (GLOSSARY): a published on-call Shift starting within 24 hours with fewer people than it needs.
 * The key follows the Shift's current cover, so a Shift that loses someone again is alerted again.
 */
export async function alertUrgentGaps(db: DB, dept: Department, now: number) {
  let alerts = 0;
  const today = instantToLocalDate(now, dept.timeZone);
  const target = { organizationId: dept.organizationId, departmentId: dept.id };
  const snap = await loadSnapshot(db, dept.id, today, addDays(today, 1), { pad: 0, publishedOnly: true });
  for (const s of snap.shifts.filter((x) => x.onCall)) {
    const { start } = shiftInterval(s, dept.timeZone);
    if (start < now || start >= now + 24 * 3_600_000) continue;
    const holders = snap.ctx.assignments.filter((a) => a.shiftId === s.id).map((a) => a.staffId).sort();
    const missing = s.headcount - holders.length;
    if (missing <= 0) continue;
    alerts += Math.sign(await notifySchedulers(db, target, {
      category: "urgent",
      urgent: true,
      title: `Urgent: ${s.label} on ${s.date} needs ${missing} more`,
      body: `${s.label} starts ${s.date} at ${formatMinute(s.startMinute)} and is ${missing} short. Assign someone or find cover.`,
      href: "/schedule",
      dedupeKey: `gap:${s.id}:${holders.join(",")}`,
    }));
  }
  return alerts;
}
