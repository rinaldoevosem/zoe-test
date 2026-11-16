import { currentInstant } from "@/server/clock";
import { can } from "@/domain/permissions";
import { instantToLocalDate } from "@/domain/time";
import { PageHeader } from "@/components/page-header";
import { DecideButtons, CancelButton, PreferencesForm, TimeOffForm } from "@/components/timeoff";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prettyDate } from "@/lib/format";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { listPreferences, listTimeOff } from "@/server/services/timeoff";
import { listShiftTypes } from "@/server/services/settings";

export const metadata = { title: "Time off" };

const tone = { approved: "default", pending: "outline", denied: "destructive", cancelled: "secondary" } as const;

export default async function TimeOffPage() {
  const actor = await requireSession();
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const today = instantToLocalDate(currentInstant(), dept.timeZone);
  const decider = can(actor, "timeoff:decide");
  const mine = actor.staffMemberId ? await listTimeOff(db, actor, "mine") : [];
  const all = decider ? await listTimeOff(db, actor, "department") : [];
  const queue = all.filter((r) => r.request.status === "pending");
  const shiftTypes = (await listShiftTypes(db, actor)).filter((t) => t.active);
  const typeName = new Map(shiftTypes.map((t) => [t.id, t.name]));
  const prefs = (await listPreferences(db, actor)).filter((p) => p.date >= today)
    .map((p) => ({ id: p.id, date: p.date, kind: p.kind, shiftTypeName: p.shiftTypeId ? typeName.get(p.shiftTypeId) ?? "Inactive Shift Type" : null }));

  return (
    <>
      <PageHeader
        title="Time off"
        description={<>Up to {dept.settings.requestLimit || "unlimited"} people may be off on the same day (Request Limit). You&apos;ll be told before you submit if a date is full.</>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {actor.staffMemberId && (
          <Card>
            <CardHeader>
              <CardTitle>Request time off</CardTitle>
              <CardDescription>Approved time off is a Hard Rule: you won&apos;t be scheduled.</CardDescription>
            </CardHeader>
            <CardContent><TimeOffForm today={today} /></CardContent>
          </Card>
        )}
        {actor.staffMemberId && (
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Dates or Shift Types you&apos;d rather not work, or would like to. Auto-fill uses them to break ties and never lets them override fairness or block the schedule.</CardDescription>
            </CardHeader>
            <CardContent><PreferencesForm today={today} preferences={prefs} shiftTypes={shiftTypes.map((t) => ({ id: t.id, name: t.name }))} /></CardContent>
          </Card>
        )}
        {decider && (
          <Card>
            <CardHeader>
              <CardTitle>Approval queue <Badge variant="secondary" className="ml-1">{queue.length}</Badge></CardTitle>
              <CardDescription>Approving shows any Shifts the person now needs replacing on.</CardDescription>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : (
                <ul className="flex flex-col gap-2">
                  {queue.map(({ request: r, name }) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-sm text-muted-foreground">{prettyDate(r.startDate)} – {prettyDate(r.endDate)}{r.note ? ` · ${r.note}` : ""}</div>
                      </div>
                      <DecideButtons id={r.id} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>{decider ? "All requests" : "My requests"}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>{decider && <TableHead>Who</TableHead>}<TableHead>Dates</TableHead><TableHead>Note</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {(decider ? all : mine).map(({ request: r, name }) => (
                <TableRow key={r.id}>
                  {decider && <TableCell className="font-medium">{name}</TableCell>}
                  <TableCell className="whitespace-nowrap">{prettyDate(r.startDate)} – {prettyDate(r.endDate)}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{r.note}</TableCell>
                  <TableCell><Badge variant={tone[r.status]} className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{r.status === "pending" && r.staffMemberId === actor.staffMemberId && <CancelButton id={r.id} />}</TableCell>
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
