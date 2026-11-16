import { boolean, date, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { RuleConfig } from "@/domain/types";

/** Every table carries organization_id (ADR-0003). */
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const org = () => text("organization_id").notNull().references(() => organizations.id);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export interface DepartmentSettings {
  rules: RuleConfig;
  tradePolicy: "auto" | "manual";
  requestLimit: number;
  /** Publish a draft period right after a clean Auto-fill run (no Hard Violations). */
  autoPublish: boolean;
}

export const departments = pgTable("departments", {
  id: id(),
  organizationId: org(),
  name: text("name").notNull(),
  timeZone: text("time_zone").notNull(),
  settings: jsonb("settings").$type<DepartmentSettings>().notNull(),
  createdAt: createdAt(),
});

export const staffMembers = pgTable("staff_members", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  clinicalRole: text("clinical_role").notNull(),
  fte: real("fte").notNull().default(1),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  /** Certifications: Tag → last qualifying date (YYYY-MM-DD). */
  tagExpiry: jsonb("tag_expiry").$type<Record<string, string>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  organizationId: org(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  permission: text("permission", { enum: ["staff", "scheduler", "admin"] }).notNull(),
  staffMemberId: text("staff_member_id").references(() => staffMembers.id),
  departmentId: text("department_id").notNull().references(() => departments.id),
  /** Notification channels: email always allowed, text message for Urgent ones; Quiet Hours in local minutes. */
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifySms: boolean("notify_sms").notNull().default(true),
  mobile: text("mobile"),
  quietStart: integer("quiet_start"),
  quietEnd: integer("quiet_end"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email").on(t.email)]);

export const shiftTypes = pgTable("shift_types", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  color: text("color").notNull().default("slate"),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  /** 0 = Sunday … 6 = Saturday */
  weekdays: jsonb("weekdays").$type<number[]>().notNull(),
  requiredTags: jsonb("required_tags").$type<string[]>().notNull().default([]),
  headcount: integer("headcount").notNull().default(1),
  weight: real("weight").notNull().default(1),
  onCall: boolean("on_call").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const schedulePeriods = pgTable("schedule_periods", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const shifts = pgTable("shifts", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  periodId: text("period_id").notNull().references(() => schedulePeriods.id),
  shiftTypeId: text("shift_type_id").notNull().references(() => shiftTypes.id),
  date: date("date", { mode: "string" }).notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  headcount: integer("headcount").notNull(),
}, (t) => [index("shifts_dept_date").on(t.departmentId, t.date), uniqueIndex("shifts_period_type_date").on(t.periodId, t.shiftTypeId, t.date)]);

export const assignments = pgTable("assignments", {
  id: id(),
  organizationId: org(),
  shiftId: text("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  staffMemberId: text("staff_member_id").notNull().references(() => staffMembers.id),
  locked: boolean("locked").notNull().default(false),
  source: text("source", { enum: ["manual", "autofill", "trade"] }).notNull().default("manual"),
  explanation: text("explanation"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("assignments_shift_staff").on(t.shiftId, t.staffMemberId), index("assignments_staff").on(t.staffMemberId)]);

export const timeOffRequests = pgTable("time_off_requests", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  staffMemberId: text("staff_member_id").notNull().references(() => staffMembers.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  note: text("note"),
  status: text("status", { enum: ["pending", "approved", "denied", "cancelled"] }).notNull().default("pending"),
  decidedBy: text("decided_by"),
  createdAt: createdAt(),
});

export const preferences = pgTable("preferences", {
  id: id(),
  organizationId: org(),
  staffMemberId: text("staff_member_id").notNull().references(() => staffMembers.id),
  date: date("date", { mode: "string" }).notNull(),
  kind: text("kind", { enum: ["avoid", "want"] }).notNull(),
  /** Null = the whole date; otherwise only Shifts of this Shift Type. */
  shiftTypeId: text("shift_type_id").references(() => shiftTypes.id),
});

export const tradeRequests = pgTable("trade_requests", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull().references(() => departments.id),
  kind: text("kind", { enum: ["swap", "giveaway", "pickup"] }).notNull(),
  status: text("status", { enum: ["open", "accepted", "approved", "rejected", "withdrawn", "declined"] }).notNull(),
  requesterId: text("requester_id").notNull().references(() => staffMembers.id),
  shiftId: text("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  counterpartyId: text("counterparty_id").references(() => staffMembers.id),
  counterpartyShiftId: text("counterparty_shift_id").references(() => shifts.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: id(),
  organizationId: org(),
  departmentId: text("department_id").notNull(),
  actorUserId: text("actor_user_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index("audit_dept_time").on(t.departmentId, t.createdAt)]);

export const notifications = pgTable("notifications", {
  id: id(),
  organizationId: org(),
  /** A Notification goes to a Staff Member, or to a User who works no Shifts (e.g. a scheduler). */
  staffMemberId: text("staff_member_id").references(() => staffMembers.id),
  userId: text("user_id").references(() => users.id),
  category: text("category", { enum: ["urgent", "trade", "schedule", "request", "reminder"] }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  /** Set by jobs that must not repeat themselves (a reminder or alert is sent once per key). */
  dedupeKey: text("dedupe_key"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("notifications_staff").on(t.staffMemberId, t.createdAt),
  index("notifications_user").on(t.userId, t.createdAt),
  index("notifications_dedupe").on(t.organizationId, t.dedupeKey),
]);

/** One attempt to send a Notification by email or text message, with its outcome (GLOSSARY: Delivery). */
export const deliveries = pgTable("deliveries", {
  id: id(),
  organizationId: org(),
  notificationId: text("notification_id").notNull().references(() => notifications.id),
  channel: text("channel", { enum: ["email", "sms"] }).notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "sent", "skipped", "failed"] }).notNull().default("pending"),
  sendAfter: timestamp("send_after", { withTimezone: true }).notNull(),
  detail: text("detail"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("deliveries_due").on(t.status, t.sendAfter), index("deliveries_org").on(t.organizationId, t.createdAt)]);

export const calendarTokens = pgTable("calendar_tokens", {
  id: id(),
  organizationId: org(),
  staffMemberId: text("staff_member_id").notNull().references(() => staffMembers.id),
  /** SHA-256 of the token; the token itself is shown once (ADR-0006). */
  tokenHash: text("token_hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("calendar_token_hash").on(t.tokenHash)]);

export const timeEntries = pgTable("time_entries", {
  id: id(),
  organizationId: org(),
  staffMemberId: text("staff_member_id").notNull().references(() => staffMembers.id),
  clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  note: text("note"),
});
