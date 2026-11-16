"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Plus, Send, Sparkles } from "lucide-react";
import { autofillAction, clearAutofillAction, createPeriodAction, publishAction } from "@/app/actions";
import { useAction } from "@/components/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Unfilled { shiftId: string; missing: number; reasons: string[] }

export function ScheduleToolbar({ period, today }: { period: { id: string; status: string; name: string } | null; today: string }) {
  const { pending, run } = useAction();
  const [unfilled, setUnfilled] = useState<Unfilled[] | null>(null);
  return (
    <>
      <NewPeriodDialog today={today} />
      {period && (
        <>
          {period.status === "draft" && (
            <Button variant="outline" disabled={pending} onClick={() => run(() => clearAutofillAction(period.id))}>
              <Eraser /> Clear Auto-fill
            </Button>
          )}
          <Button variant="secondary" disabled={pending} data-testid="autofill" onClick={() => run(() => autofillAction(period.id), (d) => setUnfilled(d?.unfilled.length ? d.unfilled : null))}>
            <Sparkles /> Auto-fill gaps
          </Button>
          {period.status === "draft" && (
            <Button disabled={pending} data-testid="publish" onClick={() => run(() => publishAction(period.id))}>
              <Send /> Publish
            </Button>
          )}
        </>
      )}
      <Dialog open={!!unfilled} onOpenChange={(o) => !o && setUnfilled(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shifts Auto-fill could not cover</DialogTitle>
            <DialogDescription>Nobody eligible was left without breaking a Hard Rule. The reasons below show who was excluded and why.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-auto text-sm">
            {unfilled?.map((u) => (
              <li key={u.shiftId} className="rounded-md border p-2">
                <div className="font-medium">{u.missing} more needed</div>
                <div className="text-muted-foreground">{u.reasons.join(" · ") || "No staff available"}</div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewPeriodDialog({ today }: { today: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: today, endDate: today });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus /> New period</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Schedule Period</DialogTitle>
          <DialogDescription>Shifts are created for every date from your active Shift Types. It starts as a draft.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createPeriodAction(form), (d) => { setOpen(false); if (d) router.push(`/schedule?period=${d.id}`); });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. March 2027" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pstart">Start</Label>
              <Input id="pstart" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pend">End</Label>
              <Input id="pend" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button disabled={pending}>Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
