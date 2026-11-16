"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveSettingsAction, saveStaffAction } from "@/app/actions";
import type { ThresholdRule } from "@/domain/types";
import { useAction } from "@/components/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { DepartmentSettings } from "@/server/db/schema";

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
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); run(() => saveSettingsAction(s)); }}>
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
                run(() => saveStaffAction({ ...rest, tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) }), () => setEditing(null));
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
