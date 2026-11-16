/**
 * Deliveries (GLOSSARY: Delivery): emails and text messages for Notifications, planned by the pure
 * notification policy and sent through pluggable providers. Without a configured provider a Delivery is
 * recorded as skipped with the reason; nothing is ever reported as sent that wasn't.
 */
import { and, desc, eq, lte } from "drizzle-orm";
import { planDeliveries } from "@/domain/notification-policy";
import { schema, type DB } from "../db";

export interface Message { to: string; subject: string; body: string }
export type SendResult = { ok: true; detail?: string } | { ok: false; error: string };
export interface Sender { send(m: Message): Promise<SendResult> }
export interface Senders { email: Sender | null; sms: Sender | null }

/** Email through Resend when RESEND_API_KEY and EVENLY_EMAIL_FROM are set. Not yet exercised against the live service. */
function resend(): Sender | null {
  const key = process.env.RESEND_API_KEY, from = process.env.EVENLY_EMAIL_FROM;
  if (!key || !from) return null;
  return {
    async send(m) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.body }),
      });
      return r.ok ? { ok: true, detail: `resend ${r.status}` } : { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
    },
  };
}

/** Text messages through Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set. Not yet exercised live. */
function twilio(): Sender | null {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return null;
  return {
    async send(m) {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: m.to, From: from, Body: `${m.subject}: ${m.body}`.slice(0, 600) }),
      });
      return r.ok ? { ok: true, detail: `twilio ${r.status}` } : { ok: false, error: `twilio ${r.status}: ${(await r.text()).slice(0, 200)}` };
    },
  };
}

export const configuredSenders = (): Senders => ({ email: resend(), sms: twilio() });

type NotificationRow = typeof schema.notifications.$inferSelect;

/** Plan email and text Deliveries for freshly created Notifications, per recipient's settings and Quiet Hours. */
export async function queueDeliveries(db: DB, organizationId: string, rows: NotificationRow[], urgent: boolean, now: number) {
  if (!rows.length) return;
  const users = await db.select().from(schema.users).where(eq(schema.users.organizationId, organizationId));
  const staff = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.organizationId, organizationId));
  const depts = await db.select().from(schema.departments).where(eq(schema.departments.organizationId, organizationId));
  const tz = new Map(depts.map((d) => [d.id, d.timeZone]));
  const values: (typeof schema.deliveries.$inferInsert)[] = [];
  for (const n of rows) {
    const user = n.userId ? users.find((u) => u.id === n.userId) : users.find((u) => u.staffMemberId === n.staffMemberId);
    // A User who also works Shifts falls back to their Staff Member's email and phone.
    const memberId = n.staffMemberId ?? user?.staffMemberId;
    const member = memberId ? staff.find((s) => s.id === memberId) : undefined;
    const timeZone = tz.get(user?.departmentId ?? member?.departmentId ?? "") ?? "UTC";
    const planned = planDeliveries(urgent ? "urgent" : "normal", {
      email: user?.email ?? member?.email ?? null,
      phone: user?.mobile ?? member?.phone ?? null,
      emailOn: user?.notifyEmail ?? true,
      smsOn: user?.notifySms ?? true,
      quietStart: user?.quietStart ?? null,
      quietEnd: user?.quietEnd ?? null,
    }, now, timeZone);
    for (const p of planned) {
      values.push({ organizationId, notificationId: n.id, channel: p.channel, to: p.to, subject: n.title, body: n.body, sendAfter: new Date(p.sendAt) });
    }
  }
  if (values.length) await db.insert(schema.deliveries).values(values);
}

/**
 * Send every pending Delivery that is due, for one Organization or (the daily job) all. Each Delivery is claimed
 * atomically (pending → sending) before it is sent, so concurrent dispatchers never send it twice.
 */
export async function dispatchDue(db: DB, now: number, senders: Senders = configuredSenders(), organizationId?: string) {
  const due = await db.update(schema.deliveries).set({ status: "sending" })
    .where(and(
      eq(schema.deliveries.status, "pending"),
      lte(schema.deliveries.sendAfter, new Date(now)),
      ...(organizationId ? [eq(schema.deliveries.organizationId, organizationId)] : []),
    ))
    .returning();
  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const d of due) {
    const sender = senders[d.channel];
    let status: "sent" | "skipped" | "failed", detail: string;
    if (!sender) {
      status = "skipped"; detail = `No ${d.channel === "email" ? "email" : "text message"} provider configured`;
    } else {
      const r = await sender.send({ to: d.to, subject: d.subject, body: d.body }).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
      status = r.ok ? "sent" : "failed";
      detail = r.ok ? r.detail ?? "sent" : r.error;
    }
    counts[status]++;
    await db.update(schema.deliveries).set({ status, detail, sentAt: status === "sent" ? new Date(now) : null }).where(eq(schema.deliveries.id, d.id));
  }
  return counts;
}

export async function recentDeliveries(db: DB, organizationId: string, limit = 20) {
  return db.select().from(schema.deliveries).where(eq(schema.deliveries.organizationId, organizationId)).orderBy(desc(schema.deliveries.createdAt)).limit(limit);
}
