import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { BottomTabs, SidebarLinks } from "@/components/nav-links";
import { navFor } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { unreadCount } from "@/server/services/notifications";

// Every page here reads the session; let them block on the server (Cache Components).
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <Image src="/icon.svg" alt="" loading="eager" width={28} height={28} />
          <span className="text-lg font-semibold tracking-tight">Zoe</span>
        </Link>
        <Suspense fallback={<NavSkeleton />}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
        <Suspense fallback={null}>
          <MobileTabs />
        </Suspense>
      </div>
    </div>
  );
}

async function Sidebar() {
  const actor = await requireSession();
  const db = await getDb();
  const [dept, unread] = await Promise.all([getDepartment(db, actor.departmentId), unreadCount(db, actor)]);
  return (
    <>
      <div className="mb-4 rounded-md border bg-background px-3 py-2 text-xs">
        <div className="font-medium">{dept.name}</div>
        <div className="text-muted-foreground">{dept.timeZone}</div>
      </div>
      <SidebarLinks items={navFor(actor, unread)} />
      <div className="mt-auto border-t pt-4">
        <div className="truncate px-2 text-sm font-medium">{actor.name}</div>
        <div className="px-2 text-xs capitalize text-muted-foreground">{actor.permission}</div>
        <form action={signOutAction} className="mt-2">
          <Button variant="ghost" size="sm" className="w-full justify-start"><LogOut /> Switch user</Button>
        </form>
      </div>
    </>
  );
}

async function MobileTabs() {
  const actor = await requireSession();
  const db = await getDb();
  const unread = await unreadCount(db, actor);
  return <BottomTabs items={navFor(actor, unread).filter((i) => i.mobile).slice(0, 5)} />;
}

function NavSkeleton() {
  return <div className="flex flex-col gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-96" />
    </div>
  );
}
