"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveSettingsAction, saveShiftTypeAction, saveStaffAction } from "@/app/actions";
import type { ThresholdRule } from "@/domain/types";
import { useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { DepartmentSettings } from "@/server/db/schema";
import type { RejudgedViolation } from "@/server/services/settings";
import { formatMinute, wallClockRange } from "@/domain/time";
import { brokenAssignmentsPhrase, SHIFT_TYPE_COLORS, shiftColor } from "@/lib/format";

/** After a configuration change, list the published Assignments it broke so the scheduler can fix them. */
function warnRejudged(d: { newHardViolations: RejudgedViolation[] } | undefined) {
  const vs = d?.newHardViolations ?? [];
  if (!vs.length) return;
  toast.warning(brokenAssignmentsPhrase(vs.length), {
    description: vs.slice(0, 6).map((v) => `• ${v.date} ${v.shiftLabel}: ${v.message}`).join("\n") + (vs.length > 6 ? `\n…and ${vs.length - 6} more in the Schedule builder` : ""),
    duration: 12000,
  });
}

const THRESHOLDS: { key: "minRestHours" | "maxConsecutiveDays" | "maxShiftsPerWeek"; label: string; unit: string }[] = [
  { key: "minRestHours", label: "Minimum rest between Shifts", unit: "hours" },
  { key: "maxConsecutiveDays", label: "Maximum consecutive working days", unit: "days" },
  { key: "maxShiftsPerWeek", label: "Maximum Shifts per week (Mon–Sun)", unit: "Shifts" },
];

export function RulesForm({ initial, readOnly }: { initial: DepartmentSettings; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [s, setS] = useState(initial);
  const setRule = (key: (typeof THRESHOLDS)[number]["key"], patch: Partial<ThresholdRule>) =>
    setS({ ...s, rules: { ...s.rules, [key]: { ...s.rules[key], ...patch } } });
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); run(() => saveSettingsAction(s), warnRejudged); }}>
      <fieldset disabled={readOnly || pending} className="grid gap-3">
        {THRESHOLDS.map(({ key, label, unit }) => {
          const r = s.rules[key];
          return (
            <div key={key} className="grid items-center gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={r.enabled} onChange={(e) => setRule(key, { enabled: e.target.checked })} />
                {label}
              </label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} className="w-20" value={r.value} onChange={(e) => setRule(key, { value: Number(e.target.value) })} aria-label={`${label} value`} />
                <span className="text-sm text-muted-foreground">{unit}</span>
              </div>
              <NativeSelect value={r.hard ? "hard" : "soft"} onChange={(e) => setRule(key, { hard: e.target.value === "hard" })} aria-label={`${label} severity`}>
                <NativeSelectOption value="hard">Hard — blocks</NativeSelectOption>
                <NativeSelectOption value="soft">Soft — warns</NativeSelectOption>
              </NativeSelect>
            </div>
          );
        })}
        <label className="flex items-center gap-2 rounded-md border p-3 text-sm font-medium">
          <input type="checkbox" className="size-4" checked={s.rules.preferences.enabled} onChange={(e) => setS({ ...s, rules: { ...s.rules, preferences: { enabled: e.target.checked } } })} />
          Honour staff Preferences (Soft)
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="policy">Trade approval</Label>
            <NativeSelect id="policy" className="w-full" value={s.tradePolicy} onChange={(e) => setS({ ...s, tradePolicy: e.target.value as "auto" | "manual" })}>
              <NativeSelectOption value="auto">Automatic when rule-clean (recommended)</NativeSelectOption>
              <NativeSelectOption value="manual">Scheduler approves every trade</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="limit">Request Limit (people off per day, 0 = unlimited)</Label>
            <Input id="limit" type="number" min={0} value={s.requestLimit} onChange={(e) => setS({ ...s, requestLimit: Number(e.target.value) })} />
          </div>
        </div>
      </fieldset>
      {!readOnly && <div><Button disabled={pending}>Save</Button></div>}
    </form>
  );
}

interface StaffRow { id?: string; name: string; clinicalRole: string; fte: number; tags: string[]; phone: string }

export function StaffEditor({ staff, readOnly }: { staff: StaffRow[]; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<(StaffRow & { tagText: string }) | null>(null);
  const open = (s?: StaffRow) => setEditing(s ? { ...s, tagText: s.tags.join(", ") } : { name: "", clinicalRole: "physician", fte: 1, tags: [], phone: "", tagText: "" });
  return (
    <>
      {!readOnly && <Button variant="outline" size="sm" className="mb-3" onClick={() => open()}><Plus /> Add Staff Member</Button>}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.clinicalRole} · FTE {s.fte}</div>
              <div className="mt-1 flex flex-wrap gap-1">{s.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
            </div>
            {!readOnly && <Button size="icon" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => open(s)}><Pencil /></Button>}
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle></DialogHeader>
          {editing && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const { tagText, ...rest } = editing;
                run(() => saveStaffAction({ ...rest, tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) }), (d) => { setEditing(null); warnRejudged(d); });
              }}
            >
              <div className="grid gap-2"><Label htmlFor="sn">Name</Label><Input id="sn" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label htmlFor="sr">Clinical Role</Label><Input id="sr" required value={editing.clinicalRole} onChange={(e) => setEditing({ ...editing, clinicalRole: e.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="sf">FTE</Label><Input id="sf" type="number" step="0.1" min="0.1" max="1" required value={editing.fte} onChange={(e) => setEditing({ ...editing, fte: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2"><Label htmlFor="st">Tags (comma separated)</Label><Input id="st" value={editing.tagText} onChange={(e) => setEditing({ ...editing, tagText: e.target.value })} placeholder="cardiac, peds" /></div>
              <div className="grid gap-2"><Label htmlFor="sp">Phone</Label><Input id="sp" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <DialogFooter><Button disabled={pending}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface ShiftTypeRow {
  id?: string; name: string; code: string; color: string; startMinute: number; endMinute: number;
  weekdays: number[]; requiredTags: string[]; headcount: number; weight: number; onCall: boolean; active: boolean;
}

const toTime = (m: number) => formatMinute(m);

export function ShiftTypeEditor({ types, readOnly }: { types: ShiftTypeRow[]; readOnly: boolean }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<(ShiftTypeRow & { start: string; end: string; tagText: string }) | null>(null);
  const open = (t?: ShiftTypeRow) => {
    const base = t ?? { name: "", code: "", color: "sky", startMinute: 420, endMinute: 1020, weekdays: [1, 2, 3, 4, 5], requiredTags: [], headcount: 1, weight: 1, onCall: false, active: true };
    setEditing({ ...base, start: toTime(base.startMinute), end: toTime(base.endMinute), tagText: base.requiredTags.join(", ") });
  };
  const save = () => {
    if (!editing) return;
    const { start, end, tagText, ...rest } = editing;
    run(() => saveShiftTypeAction({ ...rest, ...wallClockRange(start, end), requiredTags: tagText.split(",").map((x) => x.trim()).filter(Boolean) }), (d) => { setEditing(null); warnRejudged(d); });
  };
  return (
    <>
      {!readOnly && <Button variant="outline" size="sm" className="mb-3" onClick={() => open()}><Plus /> Add Shift Type</Button>}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <li key={t.id} className={`flex items-start justify-between gap-2 rounded-md border p-3 ${t.active ? "" : "opacity-60"}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-xs ${shiftColor(t.color)}`}>{t.code}</span>
                <span className="truncate font-medium">{t.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {toTime(t.startMinute)}–{toTime(t.endMinute)}{t.endMinute > 1440 ? " +1" : ""} · {t.weekdays.map((d) => DAYS[d]).join(" ")} · needs {t.headcount} · weight {t.weight}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.onCall && <Badge variant="outline">on call</Badge>}
                {!t.active && <Badge variant="secondary">inactive</Badge>}
                {t.requiredTags.map((x) => <Badge key={x} variant="secondary">{x}</Badge>)}
              </div>
            </div>
            {!readOnly && <Button size="icon" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => open(t)}><Pencil /></Button>}
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Shift Type" : "Add Shift Type"}</DialogTitle></DialogHeader>
          {editing && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <p className="text-xs text-muted-foreground">Times, headcount and weekdays apply to Schedule Periods you create from now on. Name, colour, required Tags, Weight and On-Call also change existing Shifts, and Evenly re-checks published schedules when you save.</p>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <div className="grid gap-2"><Label htmlFor="stn">Name</Label><Input id="stn" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="stc">Code</Label><Input id="stc" required maxLength={6} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="grid gap-2"><Label htmlFor="sts">Start</Label><Input id="sts" type="time" required value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="ste">End</Label><Input id="ste" type="time" required value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="sth">Needs</Label><Input id="sth" type="number" min={1} max={50} required value={editing.headcount} onChange={(e) => setEditing({ ...editing, headcount: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label htmlFor="stw">Weight</Label><Input id="stw" type="number" step="0.1" min={0.1} max={10} required value={editing.weight} onChange={(e) => setEditing({ ...editing, weight: Number(e.target.value) })} /></div>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">An end time at or before the start means the Shift ends the next day.</p>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Weekdays</legend>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d, i) => {
                    const on = editing.weekdays.includes(i);
                    return (
                      <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on}
                        onClick={() => setEditing({ ...editing, weekdays: on ? editing.weekdays.filter((x) => x !== i) : [...editing.weekdays, i] })}>{d}</Button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid gap-2"><Label htmlFor="stt">Required Tags (comma separated)</Label><Input id="stt" value={editing.tagText} onChange={(e) => setEditing({ ...editing, tagText: e.target.value })} placeholder="cardiac, peds" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="stcol">Colour</Label>
                  <NativeSelect id="stcol" className="w-full" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })}>
                    {SHIFT_TYPE_COLORS.map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
                  </NativeSelect>
                </div>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={editing.onCall} onChange={(e) => setEditing({ ...editing, onCall: e.target.checked })} /> On-Call</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
                </div>
              </div>
              <DialogFooter><Button disabled={pending}>Save</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
