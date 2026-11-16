"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { addPreferenceAction, cancelTimeOffAction, decideTimeOffAction, limitCheckAction, removePreferenceAction, requestTimeOffAction } from "@/app/actions";
import { useAction } from "@/components/use-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prettyDate } from "@/lib/format";

export function TimeOffForm({ today }: { today: string }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ startDate: today, endDate: today, note: "" });
  const [full, setFull] = useState<string[]>([]);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    limitCheckAction(form.startDate, form.endDate).then((r) => {
      if (!live || !r.ok || !r.data) return;
      setFull(r.data.dates);
      setRangeError(r.data.error);
    });
    return () => { live = false; };
  }, [form.startDate, form.endDate]);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => requestTimeOffAction({ ...form, note: form.note || undefined }), () => setForm({ ...form, note: "" }));
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="start">From</Label>
          <Input id="start" type="date" min={today} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end">To</Label>
          <Input id="end" type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Conference, vacation…" />
      </div>
      {rangeError && <p className="text-sm text-destructive">{rangeError}</p>}
      {full.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Request Limit reached</AlertTitle>
          <AlertDescription>Too many colleagues are already off on {full.map((d) => prettyDate(d)).join(", ")}. Pick other dates or talk to your scheduler.</AlertDescription>
        </Alert>
      )}
      <Button disabled={pending || full.length > 0 || !!rangeError}>Send request</Button>
    </form>
  );
}

export function DecideButtons({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideTimeOffAction(id, "denied"))}><X /> Deny</Button>
      <Button size="sm" disabled={pending} onClick={() => run(() => decideTimeOffAction(id, "approved"))}><Check /> Approve</Button>
    </div>
  );
}

export function CancelButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelTimeOffAction(id))}>Cancel</Button>;
}

export function PreferencesForm({ today, preferences }: { today: string; preferences: { id: string; date: string }[] }) {
  const { pending, run } = useAction();
  const [day, setDay] = useState(today);
  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addPreferenceAction(day)); }}>
        <Input type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date you'd rather not work" />
        <Button variant="outline" disabled={pending}>Add</Button>
      </form>
      {preferences.length === 0 ? <p className="text-sm text-muted-foreground">No Preferences yet.</p> : (
        <ul className="flex flex-wrap gap-2">
          {preferences.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm">
              {prettyDate(p.date)}
              <Button size="icon" variant="ghost" className="size-6" aria-label={`Remove ${p.date}`} disabled={pending} onClick={() => run(() => removePreferenceAction(p.id))}><X /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
