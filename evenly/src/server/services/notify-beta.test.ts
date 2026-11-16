import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPgliteDb, schema, type DB } from "../db";
import { seed } from "../db/seed";
import { loadSnapshot } from "../repo";
import { notifySchedulers } from "./common";
import { runDailyJob } from "./daily";
import { dispatchDue } from "./delivery";
import { saveStaffMember } from "./settings";

// Daily job, Urgent alerts, Deliveries and Quiet Hours (.scratch/evenly-beta tickets 07 and 08).
// Providers are "configured" with test keys and `fetch` is stubbed, so the real Resend/Twilio request code runs.
const NOW = Date.parse("2026-11-16T15:00:00Z"); // 10:00 in New York
const sent: { url: string; body: string }[] = [];
let db: DB;

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
  Object.assign(process.env, { RESEND_API_KEY: "test", EVENLY_EMAIL_FROM: "evenly@test.example", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15550000", EVENLY_NOW: new Date(NOW).toISOString() });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), body: String(init.body) });
    return new Response("{}", { status: 200 });
  });
}, 120_000);

afterAll(() => {
  vi.unstubAllGlobals();
  for (const k of ["RESEND_API_KEY", "EVENLY_EMAIL_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "EVENLY_NOW"]) delete process.env[k];
});

describe("daily job", () => {
  test("reminds about a Certification expiring within 30 days and reports an expired one, once each", async () => {
    const first = await runDailyJob(db, NOW);
    expect(first.reminders).toBe(1);
    expect(first.expired).toBe(1);
    expect(first.urgentGaps).toBe(0);
    const [okafor] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.name, "Dr. Daniel Okafor"));
    const [n] = await db.select().from(schema.notifications).where(and(eq(schema.notifications.staffMemberId, okafor.id), eq(schema.notifications.category, "reminder")));
    expect(n.title).toBe("Your procedures Certification expires on 2026-12-06");
    const again = await runDailyJob(db, NOW);
    expect([again.reminders, again.expired, again.urgentGaps]).toEqual([0, 0, 0]);
  });

  test("an uncovered on-call Shift in the next 24 hours alerts schedulers as Urgent, by email and text", async () => {
    const snap = await loadSnapshot(db, (await db.select().from(schema.departments))[0].id, "2026-11-16", "2026-11-16", { pad: 0, publishedOnly: true });
    const tonight = snap.shifts.find((s) => s.label === "Nocturnist")!;
    await db.delete(schema.assignments).where(eq(schema.assignments.shiftId, tonight.id));
    sent.length = 0;
    const r = await runDailyJob(db, NOW);
    expect(r.urgentGaps).toBe(1);
    const alerts = await db.select().from(schema.notifications).where(eq(schema.notifications.dedupeKey, `gap:${tonight.id}:`)); // key follows current cover: nobody
    expect(alerts.map((a) => a.title)).toContain("Urgent: Nocturnist on 2026-11-16 needs 2 more");
    expect(alerts.every((a) => a.category === "urgent")).toBe(true);
    const ds = await db.select().from(schema.deliveries).where(eq(schema.deliveries.subject, "Urgent: Nocturnist on 2026-11-16 needs 2 more"));
    expect(ds.map((d) => d.channel).sort()).toEqual(["email", "email", "sms"]); // Pat (no mobile) and Dr. Lee (staff phone)
    expect(ds.every((d) => d.status === "sent")).toBe(true);
    expect(sent.some((m) => m.url.includes("api.twilio.com") && m.body.includes("Urgent"))).toBe(true);
    expect(sent.some((m) => m.url.includes("api.resend.com") && JSON.parse(m.body).to[0] === "pat.rivera@riverside.example")).toBe(true);
    expect((await runDailyJob(db, NOW)).urgentGaps).toBe(0);
  });
});

describe("Quiet Hours", () => {
  test("hold a normal email until they end, then the daily dispatch sends it", async () => {
    const [pat] = await db.select().from(schema.users).where(eq(schema.users.permission, "scheduler"));
    await db.update(schema.users).set({ quietStart: 21 * 60, quietEnd: 7 * 60, notifySms: false }).where(eq(schema.users.id, pat.id));
    const late = Date.parse("2026-11-17T04:00:00Z"); // 23:00 in New York
    process.env.EVENLY_NOW = new Date(late).toISOString();
    await notifySchedulers(db, { organizationId: pat.organizationId, departmentId: pat.departmentId }, { category: "trade", title: "Quiet test", body: "Waits" });
    const [held] = await db.select().from(schema.deliveries).where(and(eq(schema.deliveries.subject, "Quiet test"), eq(schema.deliveries.to, pat.email)));
    expect(held.status).toBe("pending");
    expect(held.sendAfter.toISOString()).toBe("2026-11-17T12:00:00.000Z"); // 07:00 in New York
    expect((await dispatchDue(db, late + 30 * 60_000)).sent).toBe(0);
    await dispatchDue(db, Date.parse("2026-11-17T12:01:00Z"));
    const [after] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, held.id));
    expect(after.status).toBe("sent");
  });

  test("without providers a Delivery is recorded as skipped, never as sent", async () => {
    const [pat] = await db.select().from(schema.users).where(eq(schema.users.permission, "scheduler"));
    await db.update(schema.users).set({ quietStart: null, quietEnd: null }).where(eq(schema.users.id, pat.id));
    delete process.env.RESEND_API_KEY;
    await notifySchedulers(db, { organizationId: pat.organizationId, departmentId: pat.departmentId }, { category: "trade", title: "No provider", body: "x" });
    const ds = await db.select().from(schema.deliveries).where(eq(schema.deliveries.subject, "No provider"));
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((d) => d.status === "skipped" && d.detail === "No email provider configured")).toBe(true);
  });
});

describe("urgency", () => {
  test("a re-judge warning after a staff edit is not Urgent: email only, never a text message", async () => {
    const [admin] = await db.select().from(schema.users).where(eq(schema.users.permission, "admin"));
    const actor = { userId: admin.id, name: admin.name, permission: admin.permission, organizationId: admin.organizationId, departmentId: admin.departmentId, staffMemberId: admin.staffMemberId };
    const [ivy] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.name, "Dr. Ivy Okonkwo"));
    const { newHardViolations } = await saveStaffMember(db, actor, { id: ivy.id, name: ivy.name, clinicalRole: ivy.clinicalRole, fte: ivy.fte, tags: [], phone: ivy.phone ?? "" }, NOW);
    expect(newHardViolations.length).toBeGreaterThan(0);
    const warning = (await db.select().from(schema.notifications).where(eq(schema.notifications.category, "urgent"))).filter((n) => !n.dedupeKey);
    expect(warning.length).toBeGreaterThan(0);
    const ds = await db.select().from(schema.deliveries).where(eq(schema.deliveries.notificationId, warning[0].id));
    expect(ds.map((d) => d.channel)).toEqual(["email"]);
  });
});
