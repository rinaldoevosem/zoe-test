import { ArrowLeftRight, Bell, CalendarDays, CalendarRange, ChartColumn, Clock, History, PhoneCall, Plane, Settings } from "lucide-react";
import { can } from "@/domain/permissions";
import type { Actor } from "@/server/services/common";

export const NAV_ICONS = {
  schedule: CalendarRange,
  me: CalendarDays,
  trades: ArrowLeftRight,
  timeoff: Plane,
  oncall: PhoneCall,
  reports: ChartColumn,
  time: Clock,
  audit: History,
  bell: Bell,
  settings: Settings,
} as const;

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: keyof typeof NAV_ICONS;
  badge?: number;
  mobile?: boolean;
}

export function navFor(actor: Actor, unread: number): NavItem[] {
  const staff = !!actor.staffMemberId;
  const sched = can(actor, "schedule:edit");
  const items: (NavItem | false)[] = [
    sched && { href: "/schedule", label: "Schedule builder", short: "Builder", icon: "schedule", mobile: true },
    staff && { href: "/me", label: "My schedule", short: "Mine", icon: "me", mobile: true },
    { href: "/trades", label: "Trades", icon: "trades", mobile: true },
    { href: "/time-off", label: sched ? "Time off & requests" : "Time off", short: "Time off", icon: "timeoff", mobile: !sched || !staff },
    { href: "/on-call", label: "Who's on call", short: "On call", icon: "oncall", mobile: true },
    can(actor, "reports:view") && { href: "/reports", label: "Reports", icon: "reports" },
    staff && { href: "/time", label: "Time clock", icon: "time" },
    can(actor, "audit:view") && { href: "/audit", label: "Audit trail", icon: "audit" },
    { href: "/notifications", label: "Notifications", short: "Inbox", icon: "bell", badge: unread || undefined, mobile: true },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];
  return items.filter((x): x is NavItem => !!x);
}
