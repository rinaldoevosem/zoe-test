export type PermissionLevel = "staff" | "scheduler" | "admin";

export type Action =
  | "schedule:view-drafts"
  | "schedule:edit"
  | "schedule:publish"
  | "timeoff:decide"
  | "trade:approve"
  | "reports:view"
  | "audit:view"
  | "config:edit";

const GRANTS: Record<PermissionLevel, readonly Action[]> = {
  staff: [],
  scheduler: ["schedule:view-drafts", "schedule:edit", "schedule:publish", "timeoff:decide", "trade:approve", "reports:view", "audit:view"],
  admin: ["schedule:view-drafts", "schedule:edit", "schedule:publish", "timeoff:decide", "trade:approve", "reports:view", "audit:view", "config:edit"],
};

export function can(user: { permission: PermissionLevel }, action: Action): boolean {
  return GRANTS[user.permission].includes(action);
}
