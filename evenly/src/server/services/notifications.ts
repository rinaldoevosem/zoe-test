import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
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

export interface ChannelSettingsView {
  email: string;
  notifyEmail: boolean;
  notifySms: boolean;
  /** The User's own mobile, else their Staff Member phone. */
  mobile: string;
  quietStart: number | null;
  quietEnd: number | null;
}

export async function getChannelSettings(db: DB, actor: Actor): Promise<ChannelSettingsView> {
  const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, actor.userId), eq(schema.users.organizationId, actor.organizationId)));
  const [m] = actor.staffMemberId ? await db.select().from(schema.staffMembers).where(eq(schema.staffMembers.id, actor.staffMemberId)) : [];
  return { email: u.email, notifyEmail: u.notifyEmail, notifySms: u.notifySms, mobile: u.mobile ?? m?.phone ?? "", quietStart: u.quietStart, quietEnd: u.quietEnd };
}

const minute = z.number().int().min(0).max(1439).nullable();
const channelInput = z.object({
  notifyEmail: z.boolean(),
  notifySms: z.boolean(),
  mobile: z.string().trim().max(30).refine((v) => v === "" || /^\+?[0-9 ()-]{7,}$/.test(v), "Use a phone number like +1 555 0100"),
  quietStart: minute,
  quietEnd: minute,
}).refine((v) => (v.quietStart === null) === (v.quietEnd === null), "Set both the start and end of Quiet Hours, or neither");

export async function saveChannelSettings(db: DB, actor: Actor, input: unknown) {
  const v = channelInput.parse(input);
  await db.update(schema.users).set({ notifyEmail: v.notifyEmail, notifySms: v.notifySms, mobile: v.mobile || null, quietStart: v.quietStart, quietEnd: v.quietEnd })
    .where(and(eq(schema.users.id, actor.userId), eq(schema.users.organizationId, actor.organizationId)));
}
