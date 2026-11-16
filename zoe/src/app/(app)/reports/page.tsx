import { currentInstant } from "@/server/clock";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { can } from "@/domain/permissions";
import { addDays, instantToLocalDate } from "@/domain/time";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { loadReport, payrollReport } from "@/server/services/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const actor = await requireSession();
  if (!can(actor, "reports:view")) redirect("/me");
  const db = await getDb();
  const sp = await searchParams;
  const dept = await getDepartment(db, actor.departmentId);
  const today = instantToLocalDate(currentInstant(), dept.timeZone);
  const valid = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const start = valid(sp.start) ? (sp.start as string) : addDays(today, -30);
  const end = valid(sp.end) ? (sp.end as string) : addDays(today, 30);
  const rows = await loadReport(db, actor, start, end);
  const payroll = await payrollReport(db, actor, addDays(today, -7), addDays(today, -1));
  const loads = rows.map((r) => r.load).filter((l) => Number.isFinite(l));
  const avg = loads.reduce((a, b) => a + b, 0) / (loads.length || 1);
  const max = Math.max(1, ...loads);
  const spread = loads.length ? Math.max(...loads) - Math.min(...loads) : 0;
  const qs = `start=${start}&end=${end}`;

  return (
    <>
      <PageHeader title="Reports" description="Fairness is Load: weighted Shifts divided by FTE. A small spread means an equitable schedule.">
        <form className="flex flex-wrap gap-2">
          <Input type="date" name="start" defaultValue={start} aria-label="From" className="w-40" />
          <Input type="date" name="end" defaultValue={end} aria-label="To" className="w-40" />
          <Button variant="outline">Apply</Button>
        </form>
      </PageHeader>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kpi label="Average Load" value={avg.toFixed(1)} />
        <Kpi label="Load spread (max − min)" value={spread.toFixed(1)} hint={spread / (avg || 1) < 0.25 ? "Equitable" : "Uneven"} />
        <Kpi label="Shifts assigned" value={String(rows.reduce((n, r) => n + r.shifts, 0))} />
      </div>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Load by Staff Member</CardTitle>
            <CardDescription>{start} → {end} · draft and published</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href={`/api/reports/load.csv?${qs}`}><Download /> CSV</Link></Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead><TableHead className="text-right">FTE</TableHead><TableHead className="text-right">Shifts</TableHead>
                <TableHead className="text-right">Hours</TableHead><TableHead className="text-right">Weekend</TableHead><TableHead className="text-right">On call</TableHead>
                <TableHead className="w-1/3">Load</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].sort((a, b) => b.load - a.load).map((r) => (
                <TableRow key={r.staffId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.fte}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.shifts}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.hours}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.weekendShifts}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.onCallShifts}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (r.load / max) * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums">{r.load}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Payroll reconciliation (last 7 days)</CardTitle>
            <CardDescription>Worked Time Entries vs scheduled hours, per person per day.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href={`/api/reports/payroll.csv?start=${addDays(today, -7)}&end=${addDays(today, -1)}`}><Download /> CSV</Link></Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Staff Member</TableHead><TableHead className="text-right">Scheduled</TableHead><TableHead className="text-right">Worked</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader>
            <TableBody>
              {payroll.slice(0, 50).map((r) => (
                <TableRow key={r.date + r.staff}>
                  <TableCell>{r.date}</TableCell><TableCell>{r.staff}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.scheduledHours}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.workedHours}</TableCell>
                  <TableCell className={`text-right tabular-nums ${Math.abs(r.varianceHours) >= 0.5 ? "font-medium text-amber-600 dark:text-amber-400" : ""}`}>{r.varianceHours}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{value}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>
      </CardContent>
    </Card>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
