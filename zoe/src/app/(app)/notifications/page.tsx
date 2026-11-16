import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MarkAllRead } from "@/components/misc-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDb } from "@/server/db";
import { requireSession } from "@/server/session";
import { listNotifications } from "@/server/services/notifications";

export const metadata = { title: "Notifications" };

const CATEGORY = { urgent: "destructive", trade: "default", schedule: "secondary", request: "outline" } as const;

export default async function NotificationsPage() {
  const actor = await requireSession();
  const db = await getDb();
  const items = await listNotifications(db, actor);
  return (
    <>
      <PageHeader title="Notifications" description="One entry per change — no duplicates. Urgent items are flagged.">
        {items.some((i) => !i.readAt) && <MarkAllRead />}
      </PageHeader>
      <Card className="py-0">
        <CardContent className="divide-y p-0">
          {items.length === 0 && <p className="p-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {items.map((n) => (
            <Link key={n.id} href={n.href ?? "#"} className={cn("flex items-start gap-3 p-4 hover:bg-accent", !n.readAt && "bg-primary/5")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  <Badge variant={CATEGORY[n.category]} className="capitalize">{n.category}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">{n.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

// Reads the session and the clock on every request (ADR-0008).
export const instant = false;
