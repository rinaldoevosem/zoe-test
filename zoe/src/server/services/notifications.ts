import { and, desc, eq, isNull, or } from "drizzle-orm";
import { schema, type DB } from "../db";
import type { Actor } from "./common";

const { notifications } = schema;

/** A User's Notifications: those addressed to their Staff Member and those addressed to them directly. */
const mine = (actor: Actor) =>
  and(
    eq(notifications.organizationId, actor.organizationId),
    actor.staffMemberId
      ? or(eq(notifications.staffMemberId, actor.staffMemberId), eq(notifications.userId, actor.userId))
      : eq(notifications.userId, actor.userId),
  );

export async function listNotifications(db: DB, actor: Actor) {
  return db.select().from(notifications).where(mine(actor)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function unreadCount(db: DB, actor: Actor) {
  const rows = await db.select({ id: notifications.id }).from(notifications).where(and(mine(actor), isNull(notifications.readAt)));
  return rows.length;
}

export async function markAllRead(db: DB, actor: Actor) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(mine(actor), isNull(notifications.readAt)));
}
