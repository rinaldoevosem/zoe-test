import { and, desc, eq, isNull } from "drizzle-orm";
import { schema, type DB } from "../db";
import type { Actor } from "./common";

const { notifications } = schema;

export async function listNotifications(db: DB, actor: Actor) {
  if (!actor.staffMemberId) return [];
  return db.select().from(notifications).where(eq(notifications.staffMemberId, actor.staffMemberId)).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function unreadCount(db: DB, actor: Actor) {
  if (!actor.staffMemberId) return 0;
  const rows = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.staffMemberId, actor.staffMemberId), isNull(notifications.readAt)));
  return rows.length;
}

export async function markAllRead(db: DB, actor: Actor) {
  if (!actor.staffMemberId) return;
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.staffMemberId, actor.staffMemberId), isNull(notifications.readAt)));
}
