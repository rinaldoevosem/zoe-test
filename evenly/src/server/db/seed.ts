/** Demo data so every flow can be tried with zero setup (spec story 40). Runs once on an empty database. */
import { addDays, instantToLocalDate } from "@/domain/time";
import { DEFAULT_RULES, type RuleConfig } from "@/domain/types";
import type { Actor } from "../services/common";
import { schema, type DB } from "./index";

const TZ = "America/New_York";

type SeedStaff = { name: string; role: string; fte: number; tags: string[]; email: string; tagExpiry?: Record<string, number> };

const ANES_STAFF: SeedStaff[] = [
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
const ANES_SHIFT_TYPES = [
  { name: "OR Day", code: "OR", color: "sky", startMinute: 7 * 60, endMinute: 17 * 60, weekdays: WEEKDAYS, requiredTags: [], headcount: 3, weight: 1, onCall: false },
  { name: "Cardiac", code: "CV", color: "rose", startMinute: 7 * 60, endMinute: 17 * 60, weekdays: WEEKDAYS, requiredTags: ["cardiac"], headcount: 1, weight: 1, onCall: false },
  { name: "Pediatrics", code: "PEDS", color: "amber", startMinute: 7 * 60, endMinute: 15 * 60, weekdays: WEEKDAYS, requiredTags: ["peds"], headcount: 1, weight: 0.8, onCall: false },
  { name: "OB Day", code: "OBD", color: "violet", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: ALL, requiredTags: ["ob"], headcount: 1, weight: 1.2, onCall: false },
  { name: "OB Night", code: "OBN", color: "indigo", startMinute: 19 * 60, endMinute: 31 * 60, weekdays: ALL, requiredTags: ["ob"], headcount: 1, weight: 1.5, onCall: true },
  { name: "Night Call", code: "CALL", color: "emerald", startMinute: 17 * 60, endMinute: 31 * 60, weekdays: ALL, requiredTags: [], headcount: 1, weight: 2, onCall: true },
  { name: "Weekend Call", code: "WKND", color: "teal", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: [0, 6], requiredTags: [], headcount: 2, weight: 1.5, onCall: true },
];


const md = (name: string, email: string, extra: string[] = [], fte = 1): SeedStaff => ({ name, role: "physician", fte, tags: ["md", ...extra], email: `${email}@riverside.example` });
/** Hospital medicine (the pilot): hospitalists in 7-day Blocks, nocturnists, APPs and a Procedure Service. */
const HM_STAFF: SeedStaff[] = [
  { ...md("Dr. Morgan Lee", "morgan.lee", ["procedures"]), tagExpiry: { procedures: 75 } },
  md("Dr. Priya Shah", "priya.shah"),
  { ...md("Dr. Daniel Okafor", "daniel.okafor", ["procedures"]), tagExpiry: { procedures: 20 } },
  md("Dr. Elena Rossi", "elena.rossi", [], 0.8),
  md("Dr. Sam Whitfield", "sam.whitfield"),
  md("Dr. Aiko Tanaka", "aiko.tanaka"),
  md("Dr. Marcus Bell", "marcus.bell"),
  md("Dr. Grace Kim", "grace.kim", ["procedures"]),
  md("Dr. Noah Fischer", "noah.fischer"),
  md("Dr. Hana Yusuf", "hana.yusuf"),
  md("Dr. Leo Martins", "leo.martins"),
  { ...md("Dr. Sofia Reyes", "sofia.reyes", ["procedures"]), tagExpiry: { procedures: -10 } },
  md("Dr. Ethan Brooks", "ethan.brooks"),
  { name: "Dr. Ivy Okonkwo", role: "physician", fte: 1, tags: ["nights"], email: "ivy.okonkwo@riverside.example" },
  { name: "Dr. Ben Carter", role: "physician", fte: 1, tags: ["nights"], email: "ben.carter@riverside.example" },
  { name: "Dr. Ruth Alvarez", role: "physician", fte: 1, tags: ["nights"], email: "ruth.alvarez@riverside.example" },
  { name: "Dr. Omar Haddad", role: "physician", fte: 1, tags: ["nights"], email: "omar.haddad@riverside.example" },
  { name: "Dr. Mei Lin", role: "physician", fte: 1, tags: ["nights"], email: "mei.lin@riverside.example" },
  { name: "Jordan Alvarez, PA-C", role: "PA", fte: 1, tags: ["app"], email: "jordan.alvarez@riverside.example" },
  { name: "Riley Chen, NP", role: "NP", fte: 1, tags: ["app"], email: "riley.chen@riverside.example" },
  { name: "Taylor Brooks, PA-C", role: "PA", fte: 1, tags: ["app"], email: "taylor.brooks@riverside.example" },
  { name: "Casey Nguyen, NP", role: "NP", fte: 1, tags: ["app"], email: "casey.nguyen@riverside.example" },
  { name: "Avery Patel, NP", role: "NP", fte: 1, tags: ["app"], email: "avery.patel@riverside.example" },
];
const HM_SHIFT_TYPES = [
  { name: "Day Team", code: "DAY", color: "sky", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: ALL, requiredTags: ["md"], headcount: 4, weight: 1, onCall: false },
  { name: "Admitter", code: "ADM", color: "amber", startMinute: 11 * 60, endMinute: 23 * 60, weekdays: ALL, requiredTags: ["md"], headcount: 1, weight: 1.1, onCall: false },
  { name: "Procedure Service", code: "PROC", color: "rose", startMinute: 8 * 60, endMinute: 16 * 60, weekdays: WEEKDAYS, requiredTags: ["procedures"], headcount: 1, weight: 0.9, onCall: false },
  { name: "Nocturnist", code: "NOC", color: "indigo", startMinute: 19 * 60, endMinute: 31 * 60, weekdays: ALL, requiredTags: ["nights"], headcount: 2, weight: 1.3, onCall: true },
  { name: "APP Day", code: "APP", color: "emerald", startMinute: 7 * 60, endMinute: 19 * 60, weekdays: ALL, requiredTags: ["app"], headcount: 2, weight: 1, onCall: false },
];
const HM_RULES: RuleConfig = {
  ...DEFAULT_RULES,
  maxConsecutiveDays: { enabled: true, hard: true, value: 7 },
  maxShiftsPerWeek: { ...DEFAULT_RULES.maxShiftsPerWeek, enabled: false },
  restAfterBlock: { enabled: true, hard: true, minBlockDays: 7, daysOff: 7 },
  continuity: { enabled: true },
};

export type Specialty = "hospital-medicine" | "anesthesiology";
const SPECIALTIES = {
  "hospital-medicine": {
    department: "Hospital Medicine", staff: HM_STAFF, shiftTypes: HM_SHIFT_TYPES, rules: HM_RULES,
    timeOff: [["Dr. Priya Shah", 3, 7, "approved", "Conference"], ["Riley Chen, NP", 10, 12, "approved", "Family"], ["Dr. Marcus Bell", 30, 34, "pending", "Vacation"], ["Dr. Grace Kim", 40, 41, "pending", "Wedding"]],
    avoid: [["Dr. Daniel Okafor", 5], ["Dr. Elena Rossi", 6]],
    tradeShiftType: "Day Team",
  },
  anesthesiology: {
    department: "Anesthesiology", staff: ANES_STAFF, shiftTypes: ANES_SHIFT_TYPES, rules: DEFAULT_RULES,
    timeOff: [["Dr. Priya Shah", 3, 7, "approved", "Conference"], ["Riley Chen, CRNA", 10, 12, "approved", "Family"], ["Dr. Marcus Bell", 30, 34, "pending", "Vacation"], ["Dr. Grace Kim", 40, 41, "pending", "Wedding"]],
    avoid: [["Dr. Daniel Okafor", 5], ["Dr. Elena Rossi", 6]],
    tradeShiftType: null,
  },
} as const satisfies Record<Specialty, unknown>;

export async function ensureSeeded(db: DB) {
  const existing = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  if (existing.length) return;
  await seed(db, (await import("../clock")).currentInstant());
}

export async function seed(db: DB, now: number, specialty: Specialty = "hospital-medicine") {
  const cfg = SPECIALTIES[specialty];
  const STAFF: readonly SeedStaff[] = cfg.staff;
  // Fixed ids for the demo people, so a signed-in cookie stays valid on any fresh, re-seeded instance (serverless previews).
  const [org] = await db.insert(schema.organizations).values({ id: "demo-org", name: "Riverside Health" }).returning();
  const [dept] = await db.insert(schema.departments).values({
    id: "demo-dept",
    organizationId: org.id,
    name: cfg.department,
    timeZone: TZ,
    settings: { rules: cfg.rules, tradePolicy: "auto", requestLimit: 3, autoPublish: false },
  }).returning();
  const staff = await db.insert(schema.staffMembers).values(STAFF.map((s, i) => ({
    id: `demo-staff-${i}`, organizationId: org.id, departmentId: dept.id, name: s.name, email: s.email, clinicalRole: s.role, fte: s.fte, tags: [...s.tags],
    tagExpiry: Object.fromEntries(Object.entries(s.tagExpiry ?? {}).map(([tag, days]) => [tag, addDays(instantToLocalDate(now, TZ), days)])),
    phone: `+1 555 01${String(i).padStart(2, "0")}`,
  }))).returning();
  const users = await db.insert(schema.users).values([
    { id: "demo-user-scheduler", organizationId: org.id, departmentId: dept.id, name: "Pat Rivera (Scheduler)", email: "pat.rivera@riverside.example", permission: "scheduler" as const },
    ...staff.map((s, i) => ({
      id: `demo-user-${i}`, organizationId: org.id, departmentId: dept.id, name: s.name, email: s.email!, permission: (i === 0 ? "admin" : "staff") as "admin" | "staff", staffMemberId: s.id,
    })),
  ]).returning();
  await db.insert(schema.shiftTypes).values(cfg.shiftTypes.map((t, i) => ({ organizationId: org.id, departmentId: dept.id, sortOrder: i, ...t })));

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
  await db.insert(schema.timeOffRequests).values(cfg.timeOff.map(([who, from, to, status, note]) => ({
    organizationId: org.id, departmentId: dept.id, staffMemberId: s(who), startDate: addDays(today, from), endDate: addDays(today, to),
    status, note, ...(status === "approved" ? { decidedBy: scheduler.name } : {}),
  })));
  await db.insert(schema.preferences).values(cfg.avoid.map(([who, days]) => ({ organizationId: org.id, staffMemberId: s(who), date: addDays(today, days), kind: "avoid" as const })));

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
  const future = snap.shifts.filter((x) => x.date > addDays(today, 2) && (cfg.tradeShiftType ? x.label === cfg.tradeShiftType : !x.requiredTags.length));
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
