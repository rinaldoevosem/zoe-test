import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ClockButton } from "@/components/misc-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/server/db";
import { myTimeEntries } from "@/server/services/reports";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";

export const metadata = { title: "Time clock" };

export default async function TimePage() {
  const actor = await requireSession();
  if (!actor.staffMemberId) redirect("/reports");
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const entries = await myTimeEntries(db, actor);
  const open = entries.find((e) => !e.clockOut);
  const fmt = (d: Date) => d.toLocaleString("en-US", { timeZone: dept.timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <>
      <PageHeader title="Time clock" description="Time Entries are reconciled against your scheduled Shifts for payroll." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{open ? "You're clocked in" : "You're clocked out"}</CardTitle>
          <CardDescription>{open ? `Since ${fmt(open.clockIn)}` : "Clock in when your Shift starts."}</CardDescription>
        </CardHeader>
        <CardContent><ClockButton direction={open ? "out" : "in"} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent entries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmt(e.clockIn)}</TableCell>
                  <TableCell>{e.clockOut ? fmt(e.clockOut) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.clockOut ? ((e.clockOut.getTime() - e.clockIn.getTime()) / 3_600_000).toFixed(2) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
