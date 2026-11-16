import { beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { addDays } from "@/domain/time";
import { evaluate } from "@/domain/rules";
import { createPgliteDb, schema, type DB } from "../db";
import { seed } from "../db/seed";
import { getDepartment, loadSnapshot } from "../repo";
import type { Actor } from "./common";
import { onCallRows, whosOnCall } from "./oncall";
import { assignBlock, createPeriod, runAutofill } from "./schedule";
import { importStaff, saveDepartmentSettings, saveShiftType, saveStaffMember } from "./settings";

// Hospital medicine pilot: the demo Department, Blocks and Auto-publish (.scratch/evenly-beta).
const NOW = Date.parse("2026-11-16T15:00:00Z");
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
}, 120_000);

describe("hospital medicine demo Department", () => {
  test("the published months are fully covered with no Hard Violations", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-10-01", "2026-11-30", { pad: 0 });
    const gaps = snap.shifts.filter((s) => snap.ctx.assignments.filter((a) => a.shiftId === s.id).length < s.headcount);
    expect(gaps).toEqual([]);
    expect(evaluate(snap.ctx).filter((v) => v.severity === "hard")).toEqual([]);
  });

  test("hospitalists work Day Team in whole 7-day Blocks", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-10-01", "2026-11-30", { pad: 0 });
    const longest = new Map<string, number>();
    for (const m of snap.ctx.staff) {
      const dates = snap.shifts.filter((s) => s.label === "Day Team" && snap.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === m.id)).map((s) => s.date).sort();
      let run = 0, best = 0;
      dates.forEach((d, i) => { run = i && addDays(dates[i - 1], 1) === d ? run + 1 : 1; best = Math.max(best, run); });
      longest.set(m.name, best);
    }
    expect([...longest.values()].filter((n) => n === 7).length).toBeGreaterThanOrEqual(5);
  });
});

describe("Auto-publish", () => {
  const turnOn = async () => {
    const dept = await getDepartment(db, admin.departmentId);
    await saveDepartmentSettings(db, admin, { ...dept.settings, autoPublish: true }, NOW);
  };

  test("a clean Auto-fill run publishes the draft period", async () => {
    await turnOn();
    const period = await createPeriod(db, scheduler, { name: "Mar 3", startDate: "2027-03-03", endDate: "2027-03-03" });
    const r = await runAutofill(db, scheduler, period.id);
    expect(r.unfilled).toEqual([]);
    expect(r.autoPublish).toEqual({ published: true });
    const [row] = await db.select().from(schema.schedulePeriods).where(eq(schema.schedulePeriods.id, period.id));
    expect(row.status).toBe("published");
  });

  test("Coverage Gaps hold the period back as a draft and say why", async () => {
    await saveShiftType(db, admin, {
      name: "Palliative consult", code: "PAL", color: "teal", startMinute: 9 * 60, endMinute: 17 * 60, weekdays: [0, 1, 2, 3, 4, 5, 6],
      requiredTags: ["palliative"], headcount: 1, weight: 1, onCall: false, active: true,
    }, NOW);
    const period = await createPeriod(db, scheduler, { name: "Mar 10", startDate: "2027-03-10", endDate: "2027-03-10" });
    const r = await runAutofill(db, scheduler, period.id);
    expect(r.autoPublish).toEqual({ published: false, reason: "Auto-publish held back: 1 Shift with Coverage Gaps" });
    const [row] = await db.select().from(schema.schedulePeriods).where(eq(schema.schedulePeriods.id, period.id));
    expect(row.status).toBe("draft");
  });

  test("Departments that never set Auto-publish don't get it", async () => {
    const [dept] = await db.select().from(schema.departments);
    expect((await getDepartment(db, dept.id)).settings.autoPublish).toBe(true);
    const settings = { ...dept.settings } as Record<string, unknown>;
    delete settings.autoPublish;
    await db.update(schema.departments).set({ settings: settings as never }).where(eq(schema.departments.id, dept.id));
    expect((await getDepartment(db, dept.id)).settings.autoPublish).toBe(false);
  });
});

describe("on-call list for the hospital", () => {
  test("covers the requested window and flattens to one row per person with stable IDs", async () => {
    const day = await whosOnCall(db, scheduler.departmentId, NOW);
    const twoDays = await whosOnCall(db, scheduler.departmentId, NOW, 48);
    expect(day.entries.map((e) => [e.label, e.date])).toEqual([["Nocturnist", "2026-11-16"]]);
    expect(twoDays.entries.map((e) => [e.label, e.date])).toEqual([["Nocturnist", "2026-11-16"], ["Nocturnist", "2026-11-17"]]);
    const rows = onCallRows(twoDays.entries);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.shift_id && r.staff_id && r.name !== "UNCOVERED")).toBe(true);
  });
});

describe("Certifications", () => {
  test("backdating a Certification's expiry lists the published Shifts it no longer qualifies for", async () => {
    const [grace] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.name, "Dr. Grace Kim"));
    // Re-judging covers published Shifts from today through 120 days ahead (other tests here publish March days too).
    const snap = await loadSnapshot(db, admin.departmentId, "2026-11-17", addDays("2026-11-16", 120), { pad: 0, publishedOnly: true });
    const graceProc = snap.shifts.filter((s) => s.label === "Procedure Service" && snap.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === grace.id));
    const { newHardViolations } = await saveStaffMember(db, admin, {
      id: grace.id, name: grace.name, clinicalRole: grace.clinicalRole, fte: grace.fte, tags: grace.tags, tagExpiry: { procedures: "2026-11-16" }, phone: grace.phone ?? "",
    }, NOW);
    expect(newHardViolations.length).toBe(graceProc.length);
    expect(newHardViolations.every((v) => v.message.includes("procedures Certification expired on 2026-11-16"))).toBe(true);
    const [after] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.id, grace.id));
    expect(after.tagExpiry).toEqual({ procedures: "2026-11-16" });
  });

  test("the demo has one expired and one soon-expiring Certification", async () => {
    const rows = await db.select().from(schema.staffMembers);
    const dated = rows.filter((r) => r.tagExpiry.procedures).map((r) => [r.name, r.tagExpiry.procedures]).sort();
    expect(dated).toContainEqual(["Dr. Sofia Reyes", "2026-11-06"]);
    expect(dated).toContainEqual(["Dr. Daniel Okafor", "2026-12-06"]);
  });
});

describe("Assign a Block", () => {
  let rested: { id: string; name: string } | undefined;

  test("assigns one person to the same Shift Type for consecutive days", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-12-01", "2026-12-01", { pad: 0 });
    const dec1 = snap.shifts.find((s) => s.label === "Day Team" && s.date === "2026-12-01")!;
    // Someone whose last Block ended long enough ago (Rest after Block is Hard in the demo).
    for (const m of await db.select().from(schema.staffMembers)) {
      if (!m.tags.includes("md")) continue;
      const ok = await assignBlock(db, scheduler, dec1.id, m.id, 7).then((r) => r.added === 7, () => false);
      if (ok) { rested = m; break; }
    }
    expect(rested).toBeDefined();
    const after = await loadSnapshot(db, scheduler.departmentId, "2026-12-01", "2026-12-07", { pad: 0 });
    const days = after.shifts.filter((s) => s.label === "Day Team" && after.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === rested!.id)).map((s) => s.date);
    expect(days).toEqual(["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07"]);
  });

  test("refuses the whole Block when one day breaks a Hard Rule, naming the day", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-12-05", "2026-12-05", { pad: 0 });
    const dec5Admit = snap.shifts.find((s) => s.label === "Admitter" && s.date === "2026-12-05")!;
    await expect(assignBlock(db, scheduler, dec5Admit.id, rested!.id, 3)).rejects.toThrow(/2026-12-05 breaks a Hard Rule/);
    const after = await loadSnapshot(db, scheduler.departmentId, "2026-12-05", "2026-12-07", { pad: 0 });
    expect(after.ctx.assignments.filter((a) => a.staffId === rested!.id)).toHaveLength(3);
  });

  test("Rest after Block sees a Block that ended before the snapshot's usual week of look-back", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-12-15", "2026-12-15");
    expect(snap.ctx.shifts.some((s) => s.date <= "2026-12-01")).toBe(true);
  });
});

describe("Staff import", () => {
  test("adds new people with a sign-in, updates existing ones by email and reports skipped rows", async () => {
    const csv = [
      "Name,Email,Clinical Role,FTE,Tags",
      'Dr. Ada Park,ada.park@riverside.example,physician,1,"md; procedures:2027-06-30"',
      "Dr. Leo Martins,LEO.MARTINS@riverside.example,,0.5,",
      "No Email,,physician,1,md",
    ].join("\n");
    const r = await importStaff(db, admin, csv, NOW);
    expect([r.created, r.updated]).toEqual([1, 1]);
    expect(r.errors).toEqual([{ line: 4, message: 'Email "" doesn\'t look like an email address' }]);
    const [ada] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.email, "ada.park@riverside.example"));
    expect(ada.tagExpiry).toEqual({ procedures: "2027-06-30" });
    const [adaUser] = await db.select().from(schema.users).where(eq(schema.users.staffMemberId, ada.id));
    expect(adaUser.permission).toBe("staff");
    const [leo] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.name, "Dr. Leo Martins"));
    expect(leo.fte).toBe(0.5);
    expect(leo.clinicalRole).toBe("physician"); // blank cell keeps the existing value
    expect(leo.tags).toEqual([]); // the Tags column is present and blank: no Tags
  });

  test("only admins can import", async () => {
    await expect(importStaff(db, scheduler, "name,email\nX,x@y.example", NOW)).rejects.toThrow(/permission/);
  });
});
