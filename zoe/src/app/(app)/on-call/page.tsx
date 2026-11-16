import { currentInstant } from "@/server/clock";
import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/server/db";
import { requireSession } from "@/server/session";
import { whosOnCall } from "@/server/services/oncall";
import { cn } from "@/lib/utils";

export const metadata = { title: "Who's on call" };

export default async function OnCallPage({ searchParams }: PageProps<"/on-call">) {
  const actor = await requireSession();
  const db = await getDb();
  const sp = await searchParams;
  const at = typeof sp.at === "string" && !Number.isNaN(Date.parse(sp.at)) ? Date.parse(sp.at) : currentInstant();
  const res = await whosOnCall(db, actor.departmentId, at);
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: res.timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const now = res.entries.filter((e) => e.onNow);
  const later = res.entries.filter((e) => !e.onNow);

  return (
    <>
      <PageHeader title="Who's on call" description={`${res.department} · times in ${res.timeZone}. Published schedules only.`}>
        <form className="flex gap-2">
          <Input type="datetime-local" name="at" aria-label="At time" className="w-56" />
          <Button variant="outline">Look up</Button>
        </form>
        <Button asChild variant="ghost"><Link href={`/api/on-call?at=${new Date(at).toISOString()}`}>JSON</Link></Button>
      </PageHeader>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">On call {sp.at ? `at ${new Date(at).toLocaleString("en-US", { timeZone: res.timeZone })}` : "now"}</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="on-call-now">
        {now.length === 0 && <p className="text-sm text-muted-foreground">Nobody is on call at this time.</p>}
        {now.map((e) => <Entry key={e.shiftId} e={e} fmt={fmt} highlight />)}
      </div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Next 24 hours</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {later.map((e) => <Entry key={e.shiftId} e={e} fmt={fmt} />)}
      </div>
    </>
  );
}

function Entry({ e, fmt, highlight }: { e: Awaited<ReturnType<typeof whosOnCall>>["entries"][number]; fmt: (s: string) => string; highlight?: boolean }) {
  return (
    <Card className={cn("py-4", highlight && "border-primary")}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{e.label}</div>
          <Badge variant={highlight ? "default" : "secondary"}>{e.code}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">{fmt(e.start)} → {fmt(e.end)}</div>
        <ul className="mt-3 flex flex-col gap-2">
          {e.staff.length === 0 && <li className="text-sm font-medium text-destructive">Uncovered</li>}
          {e.staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span><span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {s.clinicalRole}</span></span>
              <span className="flex gap-1">
                {s.phone && <Button asChild size="icon" variant="outline" className="size-8"><a href={`tel:${s.phone}`} aria-label={`Call ${s.name}`}><Phone /></a></Button>}
                {s.email && <Button asChild size="icon" variant="outline" className="size-8"><a href={`mailto:${s.email}`} aria-label={`Email ${s.name}`}><Mail /></a></Button>}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
