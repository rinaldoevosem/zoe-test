/** Demo data so every flow can be tried with zero setup (spec story 40). Runs once on an empty database. */
import { addDays, instantToLocalDate } from "@/domain/time";
import { DEFAULT_RULES } from "@/domain/types";
import type { Actor } from "../services/common";
import { schema, type DB } from "./index";

const TZ = "America/New_York";

const STAFF: { name: string; role: string; fte: number; tags: string[]; email: string }[] = [
  { name: "Dr. Morgan Lee", role: "physician", fte: 1, tags: ["cardiac", "ob"], email: "morgan.lee@riverside.example" },
  { name: "Dr. Priya Shah", role: "physician", fte: 1, tags: ["peds", "regional"], email: "priya.shah@riverside.example" },
  { name: "Dr. Daniel Okafor", role: "physician", fte: 1, tags: ["cardiac"], email: "daniel.okafor@riverside.example" },
  { name: "Dr. Elena Rossi", role: "physician", fte: 0.8, tags: ["ob", "regional"], email: "elena.rossi@riverside.example" },
  { name: "Dr. Sam Whitfield", role: "physician", fte: 1, tags: ["peds"], email: "sam.whitfield@riverside.example" },
  { name: "Dr. Aiko Tanaka", role: "physician", fte: 0.6, tags: ["ob"], email: "aiko.tanaka@riverside.example" },
  { name: "Dr. Marcus Bell", role: "physician", fte: 1, tags: ["regional"], email: "marcus.bell@riverside.example" },
  { name: "Dr. Grace Kim", role: "physician", fte: 1, tags: ["ob", "peds"], email: "grace.kim@riverside.example" },
  { name: "Jordan Alvarez, CRNA", role: "CRNA", fte: 1, tags: ["ob"], email: "jordan.alvarez@riverside.example" },
  { name: "Riley Chen, CRNA", role: "CRNA", fte: 1, tags: [], email: "riley.chen@riverside.example" },
  { name: "Taylor Brooks, CRNA", role: "CRNA", fte: 0.5, tags: ["regional"], email: "taylor.brooks@riverside.example" },
  { name: "Casey Nguyen, CRNA", role: "CRNA", fte: 1, tags: ["peds"], email: "casey.nguyen@riverside.example" },
  { name: "Dr. Noah Fischer", role: "physician", fte: 1, tags: ["cardiac", "regional"], email: "noah.fischer@riverside.example" },
  { name: "Dr. Hana Yusuf", role: "physician", fte: 1, tags: ["ob"], email: "hana.yusuf@riverside.example" },
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const SHIFT_TYPES = [
  { name: "OR Day", code: "OR", color: "sky", startMinute: 7 * 60, endMinute: 17 * 60, weekdays: WEEKDAYS, requiredTags: [], headcount: 3, weight: 1, onCall: false },
  { name: "Cardiac", code: "CV", color: "rose", startMinute: 7 * 60, endMinute: 17 * 60, weekdays: WEEKDAYS, requiredTags: ["cardiac"], headcount: 1, weight: 1, onCall: false },
  { name: "Pediatrics", code: "PEDS", color: "amber", startMinute: 7 * 60, endMinute: 15 * 60, weekdays: WEEKDAYS, requiredTags: ["peds"], headcount: 1, weight: 0.8, onCall: false },
  { name: "OB Day", code: "OBD", color: "violet", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: ALL, requiredTags: ["ob"], headcount: 1, weight: 1.2, onCall: false },
  { name: "OB Night", code: "OBN", color: "indigo", startMinute: 19 * 60, endMinute: 31 * 60, weekdays: ALL, requiredTags: ["ob"], headcount: 1, weight: 1.5, onCall: true },
  { name: "Night Call", code: "CALL", color: "emerald", startMinute: 17 * 60, endMinute: 31 * 60, weekdays: ALL, requiredTags: [], headcount: 1, weight: 2, onCall: true },
  { name: "Weekend Call", code: "WKND", color: "teal", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: [0, 6], requiredTags: [], headcount: 2, weight: 1.5, onCall: true },
];

export async function ensureSeeded(db: DB) {
  const existing = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  if (existing.length) return;
  await seed(db, (await import("../clock")).currentInstant());
}

export async function seed(db: DB, now: number) {
  const [org] = await db.insert(schema.organizations).values({ name: "Riverside Health" }).returning();
  const [dept] = await db.insert(schema.departments).values({
    organizationId: org.id,
    name: "Anesthesiology",
    timeZone: TZ,
    settings: { rules: DEFAULT_RULES, tradePolicy: "auto", requestLimit: 3 },
  }).returning();
  const staff = await db.insert(schema.staffMembers).values(STAFF.map((s, i) => ({
    organizationId: org.id, departmentId: dept.id, name: s.name, email: s.email, clinicalRole: s.role, fte: s.fte, tags: s.tags,
    phone: `+1 555 01${String(i).padStart(2, "0")}`,
  }))).returning();
  const users = await db.insert(schema.users).values([
    { organizationId: org.id, departmentId: dept.id, name: "Pat Rivera (Scheduler)", email: "pat.rivera@riverside.example", permission: "scheduler" as const },
    ...staff.map((s, i) => ({
      organizationId: org.id, departmentId: dept.id, name: s.name, email: s.email!, permission: (i === 0 ? "admin" : "staff") as "admin" | "staff", staffMemberId: s.id,
    })),
  ]).returning();
  await db.insert(schema.shiftTypes).values(SHIFT_TYPES.map((t, i) => ({ organizationId: org.id, departmentId: dept.id, sortOrder: i, ...t })));

  const scheduler: Actor = { userId: users[0].id, name: users[0].name, permission: "scheduler", organizationId: org.id, departmentId: dept.id, staffMemberId: null };
  const today = instantToLocalDate(now, TZ);
  const monthStart = (d: string, offset: number) => {
    const [y, m] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + offset, 1));
    return dt.toISOString().slice(0, 10);
  };
  const months = [-1, 0, 1].map((o) => {
    const start = monthStart(today, o);
    const end = addDays(monthStart(today, o + 1), -1);
    const name = new Date(start + "T12:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return { start, end, name };
  });

  const s = (name: string) => staff.find((x) => x.name === name)!.id;
  // Time off and preferences before Auto-fill so the schedule respects them.
  await db.insert(schema.timeOffRequests).values([
    { organizationId: org.id, departmentId: dept.id, staffMemberId: s("Dr. Priya Shah"), startDate: addDays(today, 3), endDate: addDays(today, 7), status: "approved", note: "Conference", decidedBy: scheduler.name },
    { organizationId: org.id, departmentId: dept.id, staffMemberId: s("Riley Chen, CRNA"), startDate: addDays(today, 10), endDate: addDays(today, 12), status: "approved", note: "Family", decidedBy: scheduler.name },
    { organizationId: org.id, departmentId: dept.id, staffMemberId: s("Dr. Marcus Bell"), startDate: addDays(today, 30), endDate: addDays(today, 34), status: "pending", note: "Vacation" },
    { organizationId: org.id, departmentId: dept.id, staffMemberId: s("Dr. Grace Kim"), startDate: addDays(today, 40), endDate: addDays(today, 41), status: "pending", note: "Wedding" },
  ]);
  await db.insert(schema.preferences).values([
    { organizationId: org.id, staffMemberId: s("Dr. Daniel Okafor"), date: addDays(today, 5), kind: "avoid" },
    { organizationId: org.id, staffMemberId: s("Dr. Elena Rossi"), date: addDays(today, 6), kind: "avoid" },
  ]);

  const { createPeriod, runAutofill, publish } = await import("../services/schedule");
  for (const [i, m] of months.entries()) {
    const period = await createPeriod(db, scheduler, { name: m.name, startDate: m.start, endDate: m.end });
    if (i < 2) {
      await runAutofill(db, scheduler, period.id);
      await publish(db, scheduler, period.id);
    }
  }

  // A Giveaway and a Swap in flight, so the trade board has content.
  const { listTrades, createTrade } = await import("../services/trades");
  const { loadSnapshot } = await import("../repo");
  const snap = await loadSnapshot(db, dept.id, addDays(today, 2), addDays(today, 20), { pad: 0, publishedOnly: true });
  const future = snap.shifts.filter((x) => x.date > addDays(today, 2) && !x.requiredTags.length);
  const actorFor = (staffId: string): Actor => {
    const u = users.find((x) => x.staffMemberId === staffId)!;
    return { userId: u.id, name: u.name, permission: u.permission, organizationId: org.id, departmentId: dept.id, staffMemberId: staffId };
  };
  const owner = (shiftId: string) => snap.ctx.assignments.find((a) => a.shiftId === shiftId)?.staffId;
  const give = future.find((x) => owner(x.id) && owner(x.id) !== s("Dr. Morgan Lee"));
  if (give) await createTrade(db, actorFor(owner(give.id)!), { kind: "giveaway", shiftId: give.id, note: "Family event — anyone?" }).catch(() => undefined);
  // Swap offered to Dr. Morgan Lee (the admin demo user) from a colleague.
  const morgan = s("Dr. Morgan Lee");
  const morganShift = future.find((x) => snap.ctx.assignments.some((a) => a.shiftId === x.id && a.staffId === morgan));
  for (const x of future) {
    const o = owner(x.id);
    if (!morganShift || !o || o === morgan || x.id === give?.id) continue;
    const ok = await createTrade(db, actorFor(o), { kind: "swap", shiftId: x.id, counterpartyId: morgan, counterpartyShiftId: morganShift.id, note: "Swap?" }).then(() => true, () => false);
    if (ok) break;
  }
  void listTrades;

  // Recent Time Entries for payroll reconciliation.
  const past = await loadSnapshot(db, dept.id, addDays(today, -7), addDays(today, -1), { pad: 0, publishedOnly: true });
  const { shiftInterval } = await import("@/domain/time");
  const entries = past.ctx.assignments.slice(0, 40).map((a, i) => {
    const sh = past.shifts.find((x) => x.id === a.shiftId)!;
    const { start, end } = shiftInterval(sh, TZ);
    const drift = ((i % 5) - 2) * 10 * 60_000;
    return { organizationId: org.id, staffMemberId: a.staffId, clockIn: new Date(start - 5 * 60_000), clockOut: new Date(end + drift) };
  });
  if (entries.length) await db.insert(schema.timeEntries).values(entries);
}
