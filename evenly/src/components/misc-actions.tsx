"use client";

import { useState } from "react";
import { CalendarPlus, Copy, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { clockAction, markAllReadAction, rotateCalendarAction } from "@/app/actions";
import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClockButton({ direction }: { direction: "in" | "out" }) {
  const { pending, run } = useAction();
  return (
    <Button size="lg" disabled={pending} variant={direction === "out" ? "secondary" : "default"} onClick={() => run(() => clockAction(direction))}>
      {direction === "in" ? <LogIn /> : <LogOut />} Clock {direction}
    </Button>
  );
}

export function MarkAllRead() {
  const { pending, run } = useAction();
  return <Button variant="outline" disabled={pending} onClick={() => run(() => markAllReadAction())}>Mark all read</Button>;
}

export function CalendarFeed({ hasToken }: { hasToken: boolean }) {
  const { pending, run } = useAction();
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {url ? (
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" size="icon" aria-label="Copy" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Copied"))}><Copy /></Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasToken ? "You have an active link. For security it is only shown once; create a new one if you lost it (the old one stops working)." : "No link yet."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(() => rotateCalendarAction(), (token) => token && setUrl(`${window.location.origin}/api/calendar/${token}.ics`))}>
          <CalendarPlus /> {hasToken ? "Create new link" : "Create link"}
        </Button>
        {url && <Button asChild variant="outline"><a href={url.replace(/^https?:/, "webcal:")}>Open in calendar app</a></Button>}
      </div>
    </div>
  );
}
