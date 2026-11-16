import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/page-header";
import { CalendarFeed } from "@/components/misc-actions";
import { RulesForm, StaffEditor } from "@/components/settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shiftColor, timeRange } from "@/lib/format";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { hasCalendarToken } from "@/server/services/calendar";
import { listShiftTypes, listStaff } from "@/server/services/settings";

export const metadata = { title: "Settings" };
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default async function SettingsPage() {
  const actor = await requireSession();
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const admin = can(actor, "config:edit");
  const [staff, types, token] = await Promise.all([listStaff(db, actor), listShiftTypes(db, actor), hasCalendarToken(db, actor)]);

  return (
    <>
      <PageHeader title="Settings" description={`${dept.name} · ${dept.timeZone}`} />
      <div className="grid gap-6">
        {actor.staffMemberId && (
          <Card>
            <CardHeader>
              <CardTitle>Calendar Feed</CardTitle>
              <CardDescription>Subscribe in Google, Outlook or Apple Calendar. It&apos;s generated live from the published schedule, so it is never out of date (your calendar app decides how often it checks; Zoe asks for every 15 minutes).</CardDescription>
            </CardHeader>
            <CardContent><CalendarFeed hasToken={token} /></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Rules & policies</CardTitle>
            <CardDescription>Required Tags, double-booking and approved time off are always Hard. The rest are yours to tune.{!admin && " Only admins can change these."}</CardDescription>
          </CardHeader>
          <CardContent><RulesForm initial={dept.settings} readOnly={!admin} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
            <CardDescription>Tags drive eligibility; FTE drives fairness.</CardDescription>
          </CardHeader>
          <CardContent>
            <StaffEditor staff={staff.map((s) => ({ id: s.id, name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags: s.tags, phone: s.phone ?? "" }))} readOnly={!admin} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shift Types</CardTitle>
            <CardDescription>New Schedule Periods generate Shifts from these.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Shift Type</TableHead><TableHead>Time</TableHead><TableHead>Days</TableHead><TableHead>Needs</TableHead><TableHead>Requires</TableHead><TableHead className="text-right">Weight</TableHead></TableRow></TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell><span className={`mr-2 rounded border px-1.5 py-0.5 text-xs ${shiftColor(t.color)}`}>{t.code}</span>{t.name}{t.onCall && <Badge variant="outline" className="ml-2">on call</Badge>}</TableCell>
                    <TableCell className="tabular-nums">{timeRange(t.startMinute, t.endMinute)}</TableCell>
                    <TableCell>{t.weekdays.map((d) => DAYS[d]).join(" ")}</TableCell>
                    <TableCell>{t.headcount}</TableCell>
                    <TableCell>{t.requiredTags.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.weight}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
