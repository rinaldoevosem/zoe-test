"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lock, LockOpen, Phone, Plus, Sparkles, X } from "lucide-react";
import { assignAction, candidatesAction, lockAction, unassignAction } from "@/app/actions";
import type { Violation } from "@/domain/types";
import { useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { prettyDate, shiftColor, timeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandidateView } from "@/server/services/schedule";

export interface GridShift {
  id: string; label: string; code: string; color: string; date: string; startMinute: number; endMinute: number;
  headcount: number; requiredTags: string[]; onCall: boolean; weight: number;
}
export interface GridAssignee {
  assignmentId: string; staffId: string; name: string; short: string; locked: boolean; source: string; explanation: string | null; violations: Violation[];
}
export interface GridCell { shift: GridShift; assignees: GridAssignee[] }

export function ScheduleGrid({ dates, types, cells, today }: {
  dates: string[];
  types: { id: string; code: string; name: string; color: string; onCall: boolean }[];
  cells: Record<string, GridCell>;
  today: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey ? cells[openKey] : null;
  return (
    <>
      <div className="max-h-[70dvh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th className="sticky left-0 z-30 min-w-24 border-b bg-card px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              {types.map((t) => (
                <th key={t.id} className="min-w-32 border-b px-2 py-2 text-left font-medium" title={t.name}>
                  <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5", shiftColor(t.color))}>
                    {t.onCall && <Phone className="size-3" />}{t.code}
                  </span>
                  <div className="mt-0.5 truncate font-normal text-muted-foreground">{t.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => {
              const dow = new Date(d + "T12:00:00Z").getUTCDay();
              const weekend = dow === 0 || dow === 6;
              return (
                <tr key={d} className={cn(weekend && "bg-muted/40", d === today && "bg-primary/5")}>
                  <td className={cn("sticky left-0 z-10 border-b px-3 py-1.5 whitespace-nowrap", weekend ? "bg-muted" : "bg-card", d === today && "font-semibold text-primary")}>
                    {prettyDate(d)}
                  </td>
                  {types.map((t) => {
                    const key = `${d}|${t.id}`;
                    const cell = cells[key];
                    if (!cell) return <td key={t.id} className="border-b px-2 py-1.5 text-muted-foreground/40">—</td>;
                    const gap = cell.shift.headcount - cell.assignees.length;
                    return (
                      <td key={t.id} className="border-b p-1 align-top">
                        <button
                          onClick={() => setOpenKey(key)}
                          data-testid={`cell-${d}-${t.code}`}
                          className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md p-1 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {cell.assignees.map((a) => {
                            const hard = a.violations.some((v) => v.severity === "hard");
                            const soft = !hard && a.violations.length > 0;
                            return (
                              <span
                                key={a.assignmentId}
                                title={[a.name, ...a.violations.map((v) => v.message)].join("\n")}
                                className={cn(
                                  "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5",
                                  shiftColor(cell.shift.color),
                                  hard && "border-destructive bg-destructive/10 text-destructive",
                                  soft && "border-amber-500",
                                )}
                              >
                                {a.locked && <Lock className="size-3" />}
                                {a.short}
                                {(hard || soft) && <AlertTriangle className="size-3" />}
                              </span>
                            );
                          })}
                          {gap > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-destructive/60 px-1.5 py-0.5 text-destructive">
                              <Plus className="size-3" />{gap}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <ShiftPanel key={open.shift.id + open.assignees.map((a) => a.assignmentId).join()} cell={open} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ShiftPanel({ cell }: { cell: GridCell }) {
  const { shift, assignees } = cell;
  const { pending, run } = useAction();
  const [candidates, setCandidates] = useState<CandidateView[] | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);
  const gap = shift.headcount - assignees.length;

  useEffect(() => {
    let live = true;
    candidatesAction(shift.id).then((r) => live && setCandidates(r.ok ? r.data ?? [] : []));
    return () => { live = false; };
  }, [shift.id, assignees.length]);

  const visible = candidates?.filter((c) => showBlocked || !c.blocked) ?? [];
  const blockedCount = candidates?.filter((c) => c.blocked).length ?? 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className={cn("rounded border px-1.5 py-0.5 text-xs", shiftColor(shift.color))}>{shift.code}</span>
          {shift.label}
        </SheetTitle>
        <SheetDescription>
          {prettyDate(shift.date, { weekday: "long", month: "long", day: "numeric" })} · {timeRange(shift.startMinute, shift.endMinute)} · needs {shift.headcount}
          {shift.requiredTags.length ? ` · requires ${shift.requiredTags.join(", ")}` : ""} · weight {shift.weight}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 px-4 pb-6">
        <section>
          <h3 className="mb-2 text-sm font-medium">Assigned ({assignees.length}/{shift.headcount})</h3>
          {assignees.length === 0 && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
          <ul className="flex flex-col gap-2">
            {assignees.map((a) => (
              <li key={a.assignmentId} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{a.name}</div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" disabled={pending} title={a.locked ? "Unlock" : "Lock (Auto-fill won't move it)"} onClick={() => run(() => lockAction(a.assignmentId, !a.locked))}>
                      {a.locked ? <Lock /> : <LockOpen />}
                    </Button>
                    <Button size="icon" variant="ghost" disabled={pending} title="Remove" onClick={() => run(() => unassignAction(a.assignmentId))}>
                      <X />
                    </Button>
                  </div>
                </div>
                {a.source === "autofill" && a.explanation && (
                  <p className="mt-1 flex gap-1 text-xs text-muted-foreground"><Sparkles className="mt-0.5 size-3 shrink-0" />{a.explanation}</p>
                )}
                <ViolationList violations={a.violations} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">{gap > 0 ? `Eligible to assign (${gap} needed)` : "Full — remove someone to assign a replacement"}</h3>
            {blockedCount > 0 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowBlocked(!showBlocked)}>
                {showBlocked ? "Hide" : "Show"} {blockedCount} blocked
              </Button>
            )}
          </div>
          {!candidates ? (
            <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((c) => (
                <li key={c.staffId} className={cn("rounded-md border p-3", c.blocked && "opacity-60")}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.clinicalRole} · FTE {c.fte} · Load {c.load}</div>
                    </div>
                    <Button size="sm" variant={c.blocked ? "outline" : c.violations.length ? "secondary" : "default"} disabled={pending || c.blocked || gap <= 0} data-testid={`assign-${c.staffId}`}
                      onClick={() => run(() => assignAction(shift.id, c.staffId))}>
                      Assign
                    </Button>
                  </div>
                  <ViolationList violations={c.violations} />
                </li>
              ))}
              {visible.length === 0 && <p className="text-sm text-muted-foreground">Nobody can take this Shift without breaking a Hard Rule.</p>}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function ViolationList({ violations }: { violations: Violation[] }) {
  if (!violations.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {violations.map((v, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs">
          <Badge variant={v.severity === "hard" ? "destructive" : "outline"} className={cn("h-5 shrink-0", v.severity === "soft" && "border-amber-500 text-amber-700 dark:text-amber-300")}>
            {v.severity}
          </Badge>
          <span>{v.message}</span>
        </li>
      ))}
    </ul>
  );
}
