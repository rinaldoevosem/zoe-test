import { beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { DEFAULT_RULES } from "@/domain/types";
import { createPgliteDb, schema, type DB } from "../db";
import { seed } from "../db/seed";
import { loadSnapshot } from "../repo";
import type { Actor } from "./common";
import { listNotifications } from "./notifications";
import { createPeriod } from "./schedule";
import { saveDepartmentSettings, saveShiftType, saveStaffMember } from "./settings";
import { addPreference, listPreferences } from "./timeoff";
import { actOnTrade, tradeBoard } from "./trades";

const NOW = Date.parse("2026-11-16T15:00:00Z");
const TODAY = "2026-11-16";
let db: DB;
let scheduler: Actor;
let admin: Actor;

const actorFor = async (where: ReturnType<typeof eq>): Promise<Actor> => {
  const [u] = await db.select().from(schema.users).where(where);
  return { userId: u.id, name: u.name, permission: u.permission, organizationId: u.organizationId, departmentId: u.departmentId, staffMemberId: u.staffMemberId };
};

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
  scheduler = await actorFor(eq(schema.users.permission, "scheduler"));
  admin = await actorFor(eq(schema.users.permission, "admin"));
}, 60_000);

describe("trade approvals under the manual policy", () => {
  test("schedulers are notified when an accepted trade waits for them", async () => {
    await saveDepartmentSettings(db, admin, { rules: DEFAULT_RULES, tradePolicy: "manual", requestLimit: 3 });
    const [give] = await db.select().from(schema.tradeRequests).where(eq(schema.tradeRequests.kind, "giveaway"));
    let taker: Actor | undefined;
    for (const m of await db.select().from(schema.staffMembers)) {
      const a = await actorFor(eq(schema.users.staffMemberId, m.id));
      if ((await tradeBoard(db, a, TODAY)).giveaways.find((g) => g.id === give.id)?.canTake) { taker = a; break; }
    }
    expect((await actOnTrade(db, taker!, give.id, "accept")).status).toBe("accepted");
    const inbox = await listNotifications(db, scheduler);
    expect(inbox.map((n) => n.title)).toContain("Trade awaiting your approval");
    await saveDepartmentSettings(db, admin, { rules: DEFAULT_RULES, tradePolicy: "auto", requestLimit: 3 });
  });
});

describe("configuration changes are re-judged against published schedules", () => {
  test("removing a Tag reports the published Assignments that now break a Hard Rule", async () => {
    const snap = await loadSnapshot(db, admin.departmentId, TODAY, "2026-11-30", { publishedOnly: true, pad: 0 });
    const cardiac = snap.shifts.find((s) => s.date >= TODAY && s.requiredTags.includes("cardiac"))!;
    const holder = snap.ctx.assignments.find((a) => a.shiftId === cardiac.id)!.staffId;
    const [m] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.id, holder));
    const result = await saveStaffMember(db, admin, { id: m.id, name: m.name, clinicalRole: m.clinicalRole, fte: m.fte, tags: m.tags.filter((t) => t !== "cardiac") }, NOW);
    expect(result.newHardViolations.some((v) => v.rule === "requiredTags" && v.staffName === m.name)).toBe(true);
    expect(result.newHardViolations.every((v) => v.date >= TODAY)).toBe(true);
  });

  test("tightening a Rule reports the newly broken Assignments; saving it unchanged reports none", async () => {
    const strict = { ...DEFAULT_RULES, minRestHours: { enabled: true, hard: true, value: 30 } };
    const first = await saveDepartmentSettings(db, admin, { rules: strict, tradePolicy: "auto", requestLimit: 3 }, NOW);
    expect(first.newHardViolations.some((v) => v.rule === "minRest")).toBe(true);
    const again = await saveDepartmentSettings(db, admin, { rules: strict, tradePolicy: "auto", requestLimit: 3 }, NOW);
    expect(again.newHardViolations).toEqual([]);
  });
});

describe("Shift Types", () => {
  test("a new Shift Type generates Shifts in the next Schedule Period; a deactivated one stops", async () => {
    const { id } = await saveShiftType(db, admin, {
      name: "Pain Clinic", code: "PAIN", color: "amber", startMinute: 8 * 60, endMinute: 16 * 60,
      weekdays: [2, 4], requiredTags: ["regional"], headcount: 1, weight: 1, onCall: false, active: true,
    });
    const jan = await createPeriod(db, scheduler, { name: "January 2027", startDate: "2027-01-01", endDate: "2027-01-31" });
    const pain = (await loadSnapshot(db, admin.departmentId, "2027-01-01", "2027-01-31", { pad: 0 })).shifts.filter((s) => s.periodId === jan.id && s.code === "PAIN");
    expect(pain.map((s) => s.date).slice(0, 3)).toEqual(["2027-01-05", "2027-01-07", "2027-01-12"]);

    await saveShiftType(db, admin, { id, name: "Pain Clinic", code: "PAIN", color: "amber", startMinute: 480, endMinute: 960, weekdays: [2, 4], requiredTags: ["regional"], headcount: 1, weight: 1, onCall: false, active: false });
    const feb = await createPeriod(db, scheduler, { name: "February 2027", startDate: "2027-02-01", endDate: "2027-02-28" });
    const febPain = (await loadSnapshot(db, admin.departmentId, "2027-02-01", "2027-02-28", { pad: 0 })).shifts.filter((s) => s.periodId === feb.id && s.code === "PAIN");
    expect(febPain).toEqual([]);
  });

  test("adding a required Tag to a Shift Type re-judges the published Shifts it already has", async () => {
    const [cardiac] = await (await import("./settings")).listShiftTypes(db, admin).then((ts) => ts.filter((t) => t.code === "CV"));
    const result = await saveShiftType(db, admin, { ...cardiac, requiredTags: [...cardiac.requiredTags, "ecmo"] }, NOW);
    expect(result.newHardViolations.length).toBeGreaterThan(0);
    expect(result.newHardViolations.every((v) => v.shiftLabel === "Cardiac" && v.message.includes("ecmo"))).toBe(true);
  });

  test("Shift Types are validated and only admins may change them", async () => {
    await expect(saveShiftType(db, admin, { name: "Bad", code: "BAD", color: "sky", startMinute: 600, endMinute: 500, weekdays: [1], requiredTags: [], headcount: 1, weight: 1, onCall: false, active: true }))
      .rejects.toThrow("End must be after start");
    await expect(saveShiftType(db, scheduler, { name: "X", code: "X", color: "sky", startMinute: 0, endMinute: 60, weekdays: [1], requiredTags: [], headcount: 1, weight: 1, onCall: false, active: true }))
      .rejects.toThrow("permission");
  });
});

describe("Preferences", () => {
  test("a Staff Member can ask to work a specific Shift Type on a date, and the Rule engine sees it", async () => {
    const [callType] = await db.select().from(schema.shiftTypes).where(eq(schema.shiftTypes.code, "CALL"));
    await addPreference(db, admin, { date: "2026-12-04", kind: "want", shiftTypeId: callType.id });
    const mine = await listPreferences(db, admin);
    expect(mine.find((p) => p.date === "2026-12-04")).toMatchObject({ kind: "want", shiftTypeId: callType.id });
    const snap = await loadSnapshot(db, admin.departmentId, "2026-12-04", "2026-12-04", { pad: 0 });
    expect(snap.ctx.preferences).toContainEqual({ staffId: admin.staffMemberId, date: "2026-12-04", kind: "want", shiftTypeId: callType.id });
  });

  test("Preferences in the past are refused", async () => {
    await expect(addPreference(db, admin, { date: "2026-01-01", kind: "avoid" }, NOW)).rejects.toThrow("past");
  });
});

