import { and, eq, inArray } from "drizzle-orm";
import { can, type Action, type PermissionLevel } from "@/domain/permissions";
import type { Violation } from "@/domain/types";
import { currentInstant } from "../clock";
import { schema, type DB } from "../db";

export interface Actor {
  userId: string;
  name: string;
  permission: PermissionLevel;
  organizationId: string;
  departmentId: string;
  staffMemberId: string | null;
}

/** A refusal the user should read: a message and, when Rules were involved, the Violations. */
export class DomainError extends Error {
  constructor(message: string, readonly violations: Violation[] = []) {
    super(message);
  }
}

export function require(actor: Actor, action: Action) {
  if (!can(actor, action)) throw new DomainError("You don't have permission to do that");
}

export async function audit(db: DB, actor: Actor, action: string, summary: string, data?: Record<string, unknown>) {
  await db.insert(schema.auditEvents).values({
    organizationId: actor.organizationId,
    departmentId: actor.departmentId,
    actorUserId: actor.userId,
    actorName: actor.name,
    action,
    summary,
    data,
  });
}

export interface NotificationInput {
  category: "urgent" | "trade" | "schedule" | "request" | "reminder";
  title: string;
  body: string;
  href?: string;
  /** Jobs pass a key so the same reminder or alert is never sent twice. */
  dedupeKey?: string;
}

async function alreadySent(db: DB, organizationId: string, dedupeKey?: string) {
  if (!dedupeKey) return false;
  const [hit] = await db.select({ id: schema.notifications.id }).from(schema.notifications)
    .where(and(eq(schema.notifications.organizationId, organizationId), eq(schema.notifications.dedupeKey, dedupeKey))).limit(1);
  return !!hit;
}

/** In-app Notifications are written here; email and text Deliveries are queued and the due ones sent. */
async function deliver(db: DB, rows: (typeof schema.notifications.$inferSelect)[]) {
  const { queueDeliveries, dispatchDue } = await import("./delivery");
  const now = currentInstant();
  await queueDeliveries(db, rows, now);
  await dispatchDue(db, now);
}

export async function notify(db: DB, organizationId: string, staffMemberIds: string[], n: NotificationInput) {
  const unique = [...new Set(staffMemberIds)];
  if (!unique.length || (await alreadySent(db, organizationId, n.dedupeKey))) return 0;
  const rows = await db.insert(schema.notifications).values(unique.map((staffMemberId) => ({ organizationId, staffMemberId, ...n }))).returning();
  await deliver(db, rows);
  return rows.length;
}

/** Notifies every User in the Department who edits the schedule and approves trades (schedulers and admins). */
export async function notifySchedulers(
  db: DB,
  actor: Pick<Actor, "organizationId" | "departmentId">,
  n: NotificationInput,
) {
  const approvers = (await db.select().from(schema.users)
    .where(and(eq(schema.users.organizationId, actor.organizationId), eq(schema.users.departmentId, actor.departmentId))))
    .filter((u) => can(u, "schedule:edit"));
  if (!approvers.length || (await alreadySent(db, actor.organizationId, n.dedupeKey))) return 0;
  const rows = await db.insert(schema.notifications).values(approvers.map((u) => ({ organizationId: actor.organizationId, userId: u.id, ...n }))).returning();
  await deliver(db, rows);
  return rows.length;
}

export async function staffNames(db: DB, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: schema.staffMembers.id, name: schema.staffMembers.name }).from(schema.staffMembers).where(inArray(schema.staffMembers.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}
