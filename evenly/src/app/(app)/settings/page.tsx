import { expiringCertifications } from "@/domain/certifications";
import { can } from "@/domain/permissions";
import { instantToLocalDate } from "@/domain/time";
import { Badge } from "@/components/ui/badge";
import { currentInstant } from "@/server/clock";
import { PageHeader } from "@/components/page-header";
import { CalendarFeed } from "@/components/misc-actions";
import { RulesForm, ShiftTypeEditor, StaffEditor } from "@/components/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { hasCalendarToken } from "@/server/services/calendar";
import { listShiftTypes, listStaff } from "@/server/services/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireSession();
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const admin = can(actor, "config:edit");
  const [staff, types, token] = await Promise.all([listStaff(db, actor), listShiftTypes(db, actor), hasCalendarToken(db, actor)]);
  const today = instantToLocalDate(currentInstant(), dept.timeZone);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const expiring = expiringCertifications(staff.map((s) => ({ ...s, tagExpiry: s.tagExpiry })), today, 60);

  return (
    <>
      <PageHeader title="Settings" description={`${dept.name} · ${dept.timeZone}`} />
      <div className="grid gap-6">
        {actor.staffMemberId && (
          <Card>
            <CardHeader>
              <CardTitle>Calendar Feed</CardTitle>
              <CardDescription>Subscribe in Google, Outlook or Apple Calendar. It&apos;s generated live from the published schedule, so it is never out of date (your calendar app decides how often it checks; Evenly asks for every 15 minutes).</CardDescription>
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
        {expiring.length > 0 && (
          <Card data-testid="expiring-certifications">
            <CardHeader>
              <CardTitle>Certifications expiring soon</CardTitle>
              <CardDescription>Expired Certifications no longer qualify anyone for Shifts that require them. Reminders go out 30 days ahead.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {expiring.map((c) => (
                  <li key={`${c.staffId}-${c.tag}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span><span className="font-medium">{names.get(c.staffId)}</span> · {c.tag}</span>
                    <Badge variant={c.daysLeft < 0 ? "destructive" : "outline"}>
                      {c.daysLeft < 0 ? `Expired ${c.expires}` : c.daysLeft === 0 ? "Expires today" : `${c.daysLeft} days left · ${c.expires}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
            <CardDescription>Tags drive eligibility (a Tag with a date is a Certification and stops qualifying after it); FTE drives fairness.</CardDescription>
          </CardHeader>
          <CardContent>
            <StaffEditor today={today} staff={staff.map((s) => ({ id: s.id, name: s.name, clinicalRole: s.clinicalRole, fte: s.fte, tags: s.tags, tagExpiry: s.tagExpiry, phone: s.phone ?? "" }))} readOnly={!admin} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shift Types</CardTitle>
            <CardDescription>New Schedule Periods generate Shifts from active Shift Types.{!admin && " Only admins can change these."}</CardDescription>
          </CardHeader>
          <CardContent>
            <ShiftTypeEditor
              readOnly={!admin}
              types={types.map((t) => ({ id: t.id, name: t.name, code: t.code, color: t.color, startMinute: t.startMinute, endMinute: t.endMinute, weekdays: t.weekdays, requiredTags: t.requiredTags, headcount: t.headcount, weight: t.weight, onCall: t.onCall, active: t.active }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
