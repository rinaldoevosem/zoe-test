import { beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, schema, type DB } from "../db";
import { seed } from "../db/seed";
import { loadSnapshot } from "../repo";
import type { Actor } from "./common";
import { assign, candidatesFor, listPeriods } from "./schedule";
import { actOnTrade, createTrade, tradeBoard } from "./trades";
import { renderFeed, rotateCalendarToken } from "./calendar";
import { whosOnCall } from "./oncall";
import { evaluate, hasHard } from "@/domain/rules";

let db: DB;
let scheduler: Actor;
const actorOf = async (staffName: string): Promise<Actor> => {
  const [m] = await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.name, staffName));
  const [u] = await db.select().from(schema.users).where(eq(schema.users.staffMemberId, m.id));
  return { userId: u.id, name: u.name, permission: u.permission, organizationId: u.organizationId, departmentId: u.departmentId, staffMemberId: m.id };
};
const NOW = Date.parse("2026-11-16T15:00:00Z");

beforeAll(async () => {
  db = await createPgliteDb();
  await seed(db, NOW);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.permission, "scheduler"));
  scheduler = { userId: u.id, name: u.name, permission: "scheduler", organizationId: u.organizationId, departmentId: u.departmentId, staffMemberId: null };
}, 60_000);

describe("schedule writes through storage", () => {
  test("the seeded, auto-filled current month has no Hard Violations", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-11-01", "2026-11-30");
    expect(hasHard(evaluate(snap.ctx))).toBe(false);
  });

  test("a Hard Violation blocks a manual Assignment and is reported in plain language", async () => {
    const [draft] = (await listPeriods(db, scheduler)).filter((p) => p.status === "draft");
    const snap = await loadSnapshot(db, scheduler.departmentId, draft.startDate, draft.endDate, { pad: 0 });
    const cardiac = snap.shifts.find((s) => s.requiredTags.includes("cardiac"))!;
    const riley = await actorOf("Riley Chen, CRNA");
    await expect(assign(db, scheduler, cardiac.id, riley.staffMemberId!)).rejects.toMatchObject({
      message: "This Assignment breaks a Hard Rule",
      violations: expect.arrayContaining([expect.objectContaining({ rule: "requiredTags" })]),
    });
    const candidates = await candidatesFor(db, scheduler, cardiac.id);
    expect(candidates[0].blocked).toBe(false);
    expect(candidates.find((c) => c.staffId === riley.staffMemberId)!.blocked).toBe(true);
  });

  test("staff can't edit the schedule", async () => {
    const riley = await actorOf("Riley Chen, CRNA");
    await expect(assign(db, riley, "x", "y")).rejects.toThrow("permission");
  });

  test("a rule-clean Giveaway is applied the moment an eligible colleague picks it up", async () => {
    const [give] = await db.select().from(schema.tradeRequests).where(eq(schema.tradeRequests.kind, "giveaway"));
    const staff = await db.select().from(schema.staffMembers);
    let taker: Actor | undefined;
    for (const m of staff) {
      const a = await actorOf(m.name);
      const board = await tradeBoard(db, a, "2026-11-16");
      if (board.giveaways.find((g) => g.id === give.id)?.canTake) { taker = a; break; }
    }
    expect(taker).toBeDefined();
    const res = await actOnTrade(db, taker!, give.id, "accept");
    expect(res.status).toBe("approved");
    const after = await db.select().from(schema.assignments).where(eq(schema.assignments.shiftId, give.shiftId));
    expect(after.map((a) => a.staffMemberId)).toContain(taker!.staffMemberId);
    expect(after.map((a) => a.staffMemberId)).not.toContain(give.requesterId);
  });

  test("a Pickup of an already covered Shift is refused", async () => {
    const snap = await loadSnapshot(db, scheduler.departmentId, "2026-11-20", "2026-11-20", { pad: 0 });
    const covered = snap.shifts.find((s) => snap.ctx.assignments.filter((a) => a.shiftId === s.id).length >= s.headcount)!;
    const riley = await actorOf("Riley Chen, CRNA");
    await expect(createTrade(db, riley, { kind: "pickup", shiftId: covered.id })).rejects.toThrow("already covered");
  });
});

describe("read models", () => {
  test("a Calendar Feed serves published Assignments and stops working once rotated", async () => {
    const morgan = await actorOf("Dr. Morgan Lee");
    const first = await rotateCalendarToken(db, morgan);
    const ics = await renderFeed(db, first, "2026-11-16");
    expect(ics).toContain("BEGIN:VEVENT");
    await rotateCalendarToken(db, morgan);
    expect(await renderFeed(db, first, "2026-11-16")).toBeNull();
  });

  test("Who's On Call lists the on-call Assignees covering the instant", async () => {
    const res = await whosOnCall(db, scheduler.departmentId, Date.parse("2026-11-17T03:00:00Z"));
    const now = res.entries.filter((e) => e.onNow);
    expect(now.map((e) => e.code).sort()).toEqual(["CALL", "OBN"]);
    expect(now.every((e) => e.staff.length === 1)).toBe(true);
  });
});
