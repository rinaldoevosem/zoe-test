import { DEFAULT_RULES } from "@/domain/types";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { evaluate, newViolations } from "@/domain/rules";
import { addDays, instantToLocalDate } from "@/domain/time";
import type { RuleKind } from "@/domain/types";
import { currentInstant } from "../clock";
import { schema, type DB } from "../db";
import { getDepartment, loadSnapshot } from "../repo";
import { brokenAssignmentsPhrase, SHIFT_TYPE_COLORS } from "@/lib/format";
import { audit, DomainError, notifySchedulers, require, type Actor } from "./common";

/** A Hard Violation a configuration change created in a published schedule. */
export interface RejudgedViolation {
  rule: RuleKind;
  staffName: string;
  shiftLabel: string;
  date: string;
  message: string;
}

const REJUDGE_HORIZON_DAYS = 120;

/**
 * Runs a configuration change and reports the Hard Violations it newly creates in published
 * schedules from today on (ADR-0002: every change is judged by the one Rule engine).
 */
async function rejudge(db: DB, actor: Actor, now: number, change: () => Promise<void>): Promise<RejudgedViolation[]> {
  const dept = await getDepartment(db, actor.departmentId);
  const today = instantToLocalDate(now, dept.timeZone);
  const end = addDays(today, REJUDGE_HORIZON_DAYS);
  const hardFromToday = async () => {
    const snap = await loadSnapshot(db, actor.departmentId, today, end, { publishedOnly: true });
    const upcoming = new Set(snap.shifts.filter((s) => s.date >= today && s.date <= end).map((s) => s.id));
    return { snap, hard: evaluate(snap.ctx).filter((v) => v.severity === "hard" && upcoming.has(v.shiftId)) };
  };
  const before = await hardFromToday();
  await change();
  const after = await hardFromToday();
  const fresh = newViolations(before.hard, after.hard);
  const shifts = new Map(after.snap.shifts.map((s) => [s.id, s]));
  const names = new Map(after.snap.ctx.staff.map((s) => [s.id, s.name]));
  const found = fresh
    .map((v) => ({ rule: v.rule, staffName: names.get(v.staffId) ?? "Unknown", shiftLabel: shifts.get(v.shiftId)!.label, date: shifts.get(v.shiftId)!.date, message: v.message }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));
  if (found.length) {
    await notifySchedulers(db, actor, {
      category: "urgent",
      title: "Published schedule needs attention",
      body: `${brokenAssignmentsPhrase(found.length)}, first on ${found[0].date} (${found[0].shiftLabel}).`,
      href: "/schedule",
    });
  }
  return found;
}

const threshold = z.object({ enabled: z.boolean(), hard: z.boolean(), value: z.number().min(0).max(200) });
const blockRest = z.object({ enabled: z.boolean(), hard: z.boolean(), minBlockDays: z.number().int().min(2).max(31), daysOff: z.number().int().min(1).max(31) });
const settingsInput = z.object({
  rules: z.object({
    minRestHours: threshold, maxConsecutiveDays: threshold, maxShiftsPerWeek: threshold, preferences: z.object({ enabled: z.boolean() }),
    restAfterBlock: blockRest.default(DEFAULT_RULES.restAfterBlock),
    continuity: z.object({ enabled: z.boolean() }).default(DEFAULT_RULES.continuity),
  }),
  tradePolicy: z.enum(["auto", "manual"]),
  requestLimit: z.number().int().min(0).max(100),
  autoPublish: z.boolean().default(false),
});

export async function saveDepartmentSettings(db: DB, actor: Actor, input: unknown, now = currentInstant()) {
  require(actor, "config:edit");
  const settings = settingsInput.parse(input);
  const newHardViolations = await rejudge(db, actor, now, async () => {
    await db.update(schema.departments).set({ settings })
      .where(and(eq(schema.departments.id, actor.departmentId), eq(schema.departments.organizationId, actor.organizationId)));
  });
  await audit(db, actor, "settings.save", `Updated Department Rules and policies${newHardViolations.length ? `; ${brokenAssignmentsPhrase(newHardViolations.length)}` : ""}`, settings);
  return { newHardViolations };
}

const staffInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  clinicalRole: z.string().min(1).max(40),
  fte: z.number().gt(0, "FTE must be above 0").max(1),
  tags: z.array(z.string().min(1).max(30)).max(20),
  tagExpiry: z.record(z.string(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-31")).default({}),
  phone: z.string().max(40).optional(),
});

export async function saveStaffMember(db: DB, actor: Actor, input: unknown, now = currentInstant()) {
  require(actor, "config:edit");
  const s = staffInput.parse(input);
  const tags = [...new Set(s.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  // Keep expiry dates only for Tags the Staff Member still holds.
  const tagExpiry = Object.fromEntries(Object.entries(s.tagExpiry).map(([t, d]) => [t.trim().toLowerCase(), d]).filter(([t]) => tags.includes(t)));
  const newHardViolations = await rejudge(db, actor, now, async () => {
    if (s.id) {
      const [row] = await db.update(schema.staffMembers).set({ name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags, tagExpiry, phone: s.phone ?? null })
        .where(and(eq(schema.staffMembers.id, s.id), eq(schema.staffMembers.departmentId, actor.departmentId), eq(schema.staffMembers.organizationId, actor.organizationId))).returning();
      if (!row) throw new DomainError("Staff Member not found");
    } else {
      await db.insert(schema.staffMembers).values({ organizationId: actor.organizationId, departmentId: actor.departmentId, name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags, tagExpiry, phone: s.phone ?? null });
    }
  });
  await audit(db, actor, "staff.save", `Saved Staff Member ${s.name}${newHardViolations.length ? `; ${brokenAssignmentsPhrase(newHardViolations.length)}` : ""}`, { tags, tagExpiry, fte: s.fte });
  return { newHardViolations };
}

export async function listStaff(db: DB, actor: Actor) {
  return db.select().from(schema.staffMembers).where(and(eq(schema.staffMembers.departmentId, actor.departmentId), eq(schema.staffMembers.organizationId, actor.organizationId))).orderBy(schema.staffMembers.name);
}

export async function listShiftTypes(db: DB, actor: Actor) {
  return db.select().from(schema.shiftTypes).where(and(eq(schema.shiftTypes.departmentId, actor.departmentId), eq(schema.shiftTypes.organizationId, actor.organizationId))).orderBy(schema.shiftTypes.sortOrder);
}

export async function listAudit(db: DB, actor: Actor, limit = 200) {
  require(actor, "audit:view");
  return db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.departmentId, actor.departmentId), eq(schema.auditEvents.organizationId, actor.organizationId))).orderBy(desc(schema.auditEvents.createdAt)).limit(limit);
}

const shiftTypeInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(60),
  code: z.string().trim().min(1, "Code is required").max(6, "Codes are at most 6 characters").transform((c) => c.toUpperCase()),
  color: z.enum(SHIFT_TYPE_COLORS),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(2880),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one weekday"),
  requiredTags: z.array(z.string().trim().min(1).max(30)).max(10),
  headcount: z.number().int().min(1).max(50),
  weight: z.number().min(0.1).max(10),
  onCall: z.boolean(),
  active: z.boolean(),
}).refine((t) => t.endMinute > t.startMinute, "End must be after start")
  .refine((t) => t.endMinute - t.startMinute <= 1440, "Shifts can't be longer than 24 hours");

/**
 * Creates or edits a Shift Type. Times, headcount and weekdays apply to Schedule Periods created
 * afterwards (existing Shifts keep what they were generated with). Name, colour, required Tags,
 * Weight and On-Call are read live by every Shift of the type, so the edit is re-judged against
 * published schedules (ADR-0002).
 */
export async function saveShiftType(db: DB, actor: Actor, input: unknown, now = currentInstant()): Promise<{ id: string; newHardViolations: RejudgedViolation[] }> {
  require(actor, "config:edit");
  const parsed = shiftTypeInput.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues.map((i) => i.message).join("; "));
  const { id, ...t } = parsed.data;
  const values = { ...t, weekdays: [...new Set(t.weekdays)].sort(), requiredTags: [...new Set(t.requiredTags.map((x) => x.toLowerCase()))] };
  const clash = (await listShiftTypes(db, actor)).find((x) => x.code === values.code && x.id !== id);
  if (clash) throw new DomainError(`Code ${values.code} is already used by ${clash.name}`);
  let savedId = id;
  const newHardViolations = await rejudge(db, actor, now, async () => {
    if (id) {
      const [row] = await db.update(schema.shiftTypes).set(values)
        .where(and(eq(schema.shiftTypes.id, id), eq(schema.shiftTypes.departmentId, actor.departmentId), eq(schema.shiftTypes.organizationId, actor.organizationId))).returning();
      if (!row) throw new DomainError("Shift Type not found");
    } else {
      const order = (await listShiftTypes(db, actor)).length;
      const [row] = await db.insert(schema.shiftTypes).values({ organizationId: actor.organizationId, departmentId: actor.departmentId, sortOrder: order, ...values }).returning();
      savedId = row.id;
    }
  });
  await audit(db, actor, id ? "shiftType.update" : "shiftType.create",
    `${id ? "Updated" : "Created"} Shift Type ${values.name}${values.active ? "" : " (inactive)"}${newHardViolations.length ? `; ${brokenAssignmentsPhrase(newHardViolations.length)}` : ""}`, values);
  return { id: savedId!, newHardViolations };
}
