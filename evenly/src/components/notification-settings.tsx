"use client";

import { useState } from "react";
import { saveChannelSettingsAction } from "@/app/actions";
import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMinute } from "@/domain/time";
import type { ChannelSettingsView } from "@/server/services/notifications";

const toMinute = (t: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** Every Notification is in the inbox; these choose email, text messages for Urgent ones, and Quiet Hours. */
export function NotificationSettings({ initial }: { initial: ChannelSettingsView }) {
  const { pending, run } = useAction();
  const [s, setS] = useState({
    ...initial,
    from: initial.quietStart === null ? "" : formatMinute(initial.quietStart),
    to: initial.quietEnd === null ? "" : formatMinute(initial.quietEnd),
  });
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      run(() => saveChannelSettingsAction({ notifyEmail: s.notifyEmail, notifySms: s.notifySms, mobile: s.mobile, quietStart: toMinute(s.from), quietEnd: toMinute(s.to) }));
    }}>
      <fieldset disabled={pending} className="grid gap-3">
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={s.notifyEmail} onChange={(e) => setS({ ...s, notifyEmail: e.target.checked })} />
          <span><span className="font-medium">Email</span> <span className="text-muted-foreground">to {s.email}</span></span>
        </label>
        <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4" checked={s.notifySms} onChange={(e) => setS({ ...s, notifySms: e.target.checked })} />
            <span><span className="font-medium">Text messages for Urgent alerts</span> <span className="text-muted-foreground">(for example an on-call Shift with nobody covering it in the next 24 hours)</span></span>
          </label>
          <Input aria-label="Mobile number" placeholder="+1 555 0100" className="sm:w-44" value={s.mobile} onChange={(e) => setS({ ...s, mobile: e.target.value })} />
        </div>
        <div className="grid gap-2 rounded-md border p-3 text-sm">
          <span className="font-medium">Quiet Hours</span>
          <span className="text-muted-foreground">No email or texts in this window except Urgent alerts; held messages go out when it ends. Leave both blank for none.</span>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="quiet-from" className="sr-only">Quiet Hours start</Label>
            <Input id="quiet-from" type="time" className="w-32" value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} />
            <span className="text-muted-foreground">to</span>
            <Label htmlFor="quiet-to" className="sr-only">Quiet Hours end</Label>
            <Input id="quiet-to" type="time" className="w-32" value={s.to} onChange={(e) => setS({ ...s, to: e.target.value })} />
          </div>
        </div>
      </fieldset>
      <div><Button disabled={pending}>Save</Button></div>
    </form>
  );
}
