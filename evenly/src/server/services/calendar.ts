import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { renderCalendar } from "@/domain/ical";
import { addDays, instantToLocalDate, shiftInterval } from "@/domain/time";
import { schema, type DB } from "../db";
import { loadSnapshot } from "../repo";
import { audit, DomainError, type Actor } from "./common";

const { calendarTokens, staffMembers } = schema;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Issues a new Calendar Feed token and revokes any previous one. The token is returned once (ADR-0006). */
export async function rotateCalendarToken(db: DB, actor: Actor): Promise<string> {
  if (!actor.staffMemberId) throw new DomainError("Only Staff Members have a Calendar Feed");
  const token = randomBytes(24).toString("base64url");
  await db.update(calendarTokens).set({ revokedAt: new Date() }).where(and(eq(calendarTokens.staffMemberId, actor.staffMemberId), isNull(calendarTokens.revokedAt)));
  await db.insert(calendarTokens).values({ organizationId: actor.organizationId, staffMemberId: actor.staffMemberId, tokenHash: hash(token) });
  await audit(db, actor, "calendar.rotate", `${actor.name} issued a new Calendar Feed link`);
  return token;
}

export async function hasCalendarToken(db: DB, actor: Actor) {
  if (!actor.staffMemberId) return false;
  const rows = await db.select({ id: calendarTokens.id }).from(calendarTokens).where(and(eq(calendarTokens.staffMemberId, actor.staffMemberId), isNull(calendarTokens.revokedAt)));
  return rows.length > 0;
}

/** Renders the feed at request time from published Assignments: never stale. */
export async function renderFeed(db: DB, token: string, now: number): Promise<string | null> {
  const [t] = await db.select().from(calendarTokens).where(and(eq(calendarTokens.tokenHash, hash(token)), isNull(calendarTokens.revokedAt)));
  if (!t) return null;
  const [member] = await db.select().from(staffMembers).where(eq(staffMembers.id, t.staffMemberId));
  if (!member) return null;
  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.id, member.departmentId));
  const today = instantToLocalDate(now, dept.timeZone);
  const snap = await loadSnapshot(db, member.departmentId, addDays(today, -60), addDays(today, 365), { publishedOnly: true, pad: 0 });
  const mine = new Set(snap.ctx.assignments.filter((a) => a.staffId === member.id).map((a) => a.shiftId));
  const updated = new Map(snap.assignmentRows.map((a) => [a.shiftId + a.staffMemberId, a.updatedAt.getTime()]));
  const events = snap.shifts.filter((s) => mine.has(s.id)).map((s) => {
    const { start, end } = shiftInterval(s, snap.department.timeZone);
    return {
      uid: `${s.id}-${member.id}@evenly`,
      start, end,
      summary: `${s.label}${s.onCall ? " (on call)" : ""}`,
      description: `${snap.department.name} · ${s.code}`,
      location: snap.department.name,
      lastModified: updated.get(s.id + member.id),
    };
  });
  return renderCalendar(`Evenly – ${member.name}`, events);
}
