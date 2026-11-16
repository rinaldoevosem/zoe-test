import { and, eq, inArray } from "drizzle-orm";
import { can, type Action, type PermissionLevel } from "@/domain/permissions";
import type { Violation } from "@/domain/types";
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

export async function notify(
  db: DB,
  organizationId: string,
  staffMemberIds: string[],
  n: { category: "urgent" | "trade" | "schedule" | "request"; title: string; body: string; href?: string },
) {
  const unique = [...new Set(staffMemberIds)];
  if (!unique.length) return;
  await db.insert(schema.notifications).values(unique.map((staffMemberId) => ({ organizationId, staffMemberId, ...n })));
}

/** Notifies every User in the Department who edits the schedule and approves trades (schedulers and admins). */
export async function notifySchedulers(
  db: DB,
  actor: Pick<Actor, "organizationId" | "departmentId">,
  n: { category: "urgent" | "trade" | "schedule" | "request"; title: string; body: string; href?: string },
) {
  const approvers = (await db.select().from(schema.users)
    .where(and(eq(schema.users.organizationId, actor.organizationId), eq(schema.users.departmentId, actor.departmentId))))
    .filter((u) => can(u, "schedule:edit"));
  if (!approvers.length) return;
  await db.insert(schema.notifications).values(approvers.map((u) => ({ organizationId: actor.organizationId, userId: u.id, ...n })));
}

export async function staffNames(db: DB, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: schema.staffMembers.id, name: schema.staffMembers.name }).from(schema.staffMembers).where(inArray(schema.staffMembers.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}
