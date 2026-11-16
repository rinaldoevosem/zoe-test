"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICONS, type NavItem } from "./nav-items";

export function SidebarLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = path === item.href || path.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = path === item.href || path.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", active && "text-primary")}>
            <Icon className="size-5" />
            {item.short ?? item.label}
            {item.badge ? <span className="absolute top-1 right-1/4 size-2 rounded-full bg-primary" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
