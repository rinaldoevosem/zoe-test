import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { schema, type DB } from "../db";
import { getDepartment } from "../repo";
import { audit, DomainError, require, type Actor } from "./common";

const threshold = z.object({ enabled: z.boolean(), hard: z.boolean(), value: z.number().min(0).max(200) });
const settingsInput = z.object({
  rules: z.object({ minRestHours: threshold, maxConsecutiveDays: threshold, maxShiftsPerWeek: threshold, preferences: z.object({ enabled: z.boolean() }) }),
  tradePolicy: z.enum(["auto", "manual"]),
  requestLimit: z.number().int().min(0).max(100),
});

export async function saveDepartmentSettings(db: DB, actor: Actor, input: unknown) {
  require(actor, "config:edit");
  const settings = settingsInput.parse(input);
  await db.update(schema.departments).set({ settings }).where(eq(schema.departments.id, actor.departmentId));
  await audit(db, actor, "settings.save", "Updated Department Rules and policies", settings);
}

const staffInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  clinicalRole: z.string().min(1).max(40),
  fte: z.number().gt(0, "FTE must be above 0").max(1),
  tags: z.array(z.string().min(1).max(30)).max(20),
  phone: z.string().max(40).optional(),
});

export async function saveStaffMember(db: DB, actor: Actor, input: unknown) {
  require(actor, "config:edit");
  const s = staffInput.parse(input);
  const tags = [...new Set(s.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (s.id) {
    const [row] = await db.update(schema.staffMembers).set({ name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags, phone: s.phone ?? null })
      .where(and(eq(schema.staffMembers.id, s.id), eq(schema.staffMembers.departmentId, actor.departmentId))).returning();
    if (!row) throw new DomainError("Staff Member not found");
  } else {
    await db.insert(schema.staffMembers).values({ organizationId: actor.organizationId, departmentId: actor.departmentId, name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags, phone: s.phone ?? null });
  }
  await audit(db, actor, "staff.save", `Saved Staff Member ${s.name}`, { tags, fte: s.fte });
}

export async function listStaff(db: DB, actor: Actor) {
  return db.select().from(schema.staffMembers).where(eq(schema.staffMembers.departmentId, actor.departmentId)).orderBy(schema.staffMembers.name);
}

export async function listShiftTypes(db: DB, actor: Actor) {
  return db.select().from(schema.shiftTypes).where(eq(schema.shiftTypes.departmentId, actor.departmentId)).orderBy(schema.shiftTypes.sortOrder);
}

export async function listAudit(db: DB, actor: Actor, limit = 200) {
  require(actor, "audit:view");
  return db.select().from(schema.auditEvents).where(eq(schema.auditEvents.departmentId, actor.departmentId)).orderBy(desc(schema.auditEvents.createdAt)).limit(limit);
}

export { getDepartment };
