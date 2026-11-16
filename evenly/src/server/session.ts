/**
 * Session seam (ADR-0008). v0: a signed cookie holding a User id, set by the "sign in as" picker.
 * Long-lived and sliding (30 days) so phones stay signed in across app switches.
 * Production replaces this file's internals with Better Auth + OIDC/SAML; callers don't change.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb, schema } from "./db";
import type { Actor } from "./services/common";

const COOKIE = "evenly_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const secret = () => process.env.EVENLY_SESSION_SECRET ?? "evenly-dev-secret-change-me";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function signIn(userId: string) {
  (await cookies()).set(COOKIE, `${userId}.${sign(userId)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/" });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Actor | null> {
  // Session-derived pages always render at request time (they read the database and the clock).
  await connection();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [userId, sig] = raw.split(".");
  const expected = sign(userId);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!u) return null;
  return { userId: u.id, name: u.name, permission: u.permission, organizationId: u.organizationId, departmentId: u.departmentId, staffMemberId: u.staffMemberId };
}

export async function requireSession(): Promise<Actor> {
  const s = await getSession();
  if (!s) redirect("/signin");
  return s;
}

/** Organizations offered by the demo sign-in picker (ADR-0008). */
export async function listSignInOrganizations() {
  const db = await getDb();
  return (await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The demo sign-in choices for ONE Organization, so one tenant's people are never listed beside another's. */
export async function listSignInUsers(organizationId: string) {
  const db = await getDb();
  const order = { scheduler: 0, admin: 1, staff: 2 } as const;
  return (await db.select({ id: schema.users.id, name: schema.users.name, permission: schema.users.permission }).from(schema.users)
    .where(eq(schema.users.organizationId, organizationId)))
    .sort((a, b) => order[a.permission] - order[b.permission] || a.name.localeCompare(b.name));
}
