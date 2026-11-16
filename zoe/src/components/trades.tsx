"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Gift, Hand, Phone } from "lucide-react";
import { createTradeAction, previewTradeAction, tradeAction } from "@/app/actions";
import type { Violation } from "@/domain/types";
import { ViolationList } from "@/components/schedule/schedule-grid";
import { useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { prettyDate, timeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardItem } from "@/server/services/trades";

type ShiftLite = NonNullable<BoardItem["shift"]>;

const describeShift = (s: ShiftLite | null) => (s ? `${s.label} · ${prettyDate(s.date)} · ${timeRange(s.startMinute, s.endMinute)}` : "Shift no longer scheduled");

export function TradeCard({ item, mode }: { item: BoardItem; mode: "incoming" | "take" | "mine" | "approve" }) {
  const { pending, run } = useAction();
  const Icon = item.kind === "swap" ? ArrowLeftRight : item.kind === "giveaway" ? Gift : Hand;
  return (
    <div className={cn("rounded-md border p-3", mode === "take" && !item.canTake && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className="size-4 text-primary" />
            <span className="capitalize">{item.kind}</span>
            <span className="text-muted-foreground">· {item.requester}{item.counterparty ? ` → ${item.counterparty}` : ""}</span>
          </div>
          <div className="mt-1 text-sm">{describeShift(item.shift)}{item.shift?.onCall && <Phone className="ml-1 inline size-3" />}</div>
          {item.kind === "swap" && <div className="text-sm text-muted-foreground">for {describeShift(item.counterpartyShift)}</div>}
          {item.note && <div className="mt-1 text-xs italic text-muted-foreground">“{item.note}”</div>}
        </div>
        <Badge variant={item.status === "approved" ? "default" : "outline"} className="capitalize">{item.status}</Badge>
      </div>
      <ViolationList violations={item.violations} />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {mode === "incoming" && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => tradeAction(item.id, "decline"))}>Decline</Button>
            <Button size="sm" disabled={pending || !item.canTake} onClick={() => run(() => tradeAction(item.id, "accept"))}>Accept swap</Button>
          </>
        )}
        {mode === "take" && <Button size="sm" disabled={pending || !item.canTake} onClick={() => run(() => tradeAction(item.id, "accept"))}>Take this Shift</Button>}
        {mode === "mine" && (item.status === "open" || item.status === "accepted") && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => tradeAction(item.id, "withdraw"))}>Withdraw</Button>
        )}
        {mode === "approve" && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => tradeAction(item.id, "reject"))}>Reject</Button>
            <Button size="sm" disabled={pending} onClick={() => run(() => tradeAction(item.id, "approve"))}>Approve</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function PickupGap({ shift, violations }: { shift: ShiftLite; violations: Violation[] }) {
  const { pending, run } = useAction();
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{describeShift(shift)}{shift.onCall && <Badge variant="destructive" className="ml-2">on call</Badge>}</div>
        <ViolationList violations={violations} />
      </div>
      <Button size="sm" disabled={pending} onClick={() => run(() => createTradeAction({ kind: "pickup", shiftId: shift.id }))}>Pick up</Button>
    </div>
  );
}

export function NewTrade({ myShifts, colleagueShifts, staff }: {
  myShifts: ShiftLite[];
  colleagueShifts: { staffId: string; shift: ShiftLite }[];
  staff: { id: string; name: string }[];
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"giveaway" | "swap">("swap");
  const [shiftId, setShiftId] = useState(myShifts[0]?.id ?? "");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [counterpartyShiftId, setCounterpartyShiftId] = useState("");
  const [note, setNote] = useState("");
  const [fetched, setPreview] = useState<{ violations: Violation[]; error: string | null } | null>(null);
  const theirShifts = useMemo(() => colleagueShifts.filter((c) => c.staffId === counterpartyId).map((c) => c.shift), [colleagueShifts, counterpartyId]);

  const input = kind === "swap"
    ? { kind, shiftId, counterpartyId: counterpartyId || undefined, counterpartyShiftId: counterpartyShiftId || undefined, note: note || undefined }
    : { kind, shiftId, note: note || undefined };
  const ready = !!shiftId && (kind === "giveaway" || (!!counterpartyId && !!counterpartyShiftId));

  useEffect(() => {
    if (!ready || kind !== "swap") return;
    let live = true;
    previewTradeAction(input).then((r) => live && setPreview(r.ok && r.data ? r.data : null));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, shiftId, counterpartyId, counterpartyShiftId]);

  const preview = ready && kind === "swap" ? fetched : null;
  const hard = preview?.violations.some((v) => v.severity === "hard") || !!preview?.error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button disabled={!myShifts.length}><ArrowLeftRight /> New trade</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New trade</DialogTitle>
          <DialogDescription>Zoe checks every Rule before anything is sent, so nobody wastes time on a trade that can&apos;t happen.</DialogDescription>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <TabsList className="w-full">
            <TabsTrigger value="swap">Swap with someone</TabsTrigger>
            <TabsTrigger value="giveaway">Give away</TabsTrigger>
          </TabsList>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mine">Your Shift</Label>
              <NativeSelect id="mine" className="w-full" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                {myShifts.map((s) => <NativeSelectOption key={s.id} value={s.id}>{describeShift(s)}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <TabsContent value="swap" className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="who">Colleague</Label>
                <NativeSelect id="who" className="w-full" value={counterpartyId} onChange={(e) => { setCounterpartyId(e.target.value); setCounterpartyShiftId(""); }}>
                  <NativeSelectOption value="">Choose…</NativeSelectOption>
                  {staff.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="theirs">Their Shift you&apos;ll take</Label>
                <NativeSelect id="theirs" className="w-full" value={counterpartyShiftId} disabled={!counterpartyId} onChange={(e) => setCounterpartyShiftId(e.target.value)}>
                  <NativeSelectOption value="">{theirShifts.length ? "Choose…" : "No upcoming Shifts"}</NativeSelectOption>
                  {theirShifts.map((s) => <NativeSelectOption key={s.id} value={s.id}>{describeShift(s)}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              {preview && (
                <div className={cn("rounded-md border p-3 text-sm", hard ? "border-destructive/50 bg-destructive/5" : "border-success/50 bg-success/5")}>
                  {preview.error ?? (hard ? "This swap breaks a Hard Rule:" : preview.violations.length ? "Allowed, with warnings:" : "✓ Rule-clean for both of you.")}
                  <ViolationList violations={preview.violations} />
                </div>
              )}
            </TabsContent>
            <TabsContent value="giveaway">
              <p className="text-sm text-muted-foreground">Everyone eligible sees it on their trade board. The first person who can take it without breaking a Hard Rule gets it.</p>
            </TabsContent>
            <div className="grid gap-2">
              <Label htmlFor="tnote">Note (optional)</Label>
              <Textarea id="tnote" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </Tabs>
        <DialogFooter>
          <Button disabled={pending || !ready || hard} onClick={() => run(() => createTradeAction(input), () => setOpen(false))}>
            {kind === "swap" ? "Send swap request" : "Offer Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
