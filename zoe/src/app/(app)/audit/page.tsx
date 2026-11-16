import { redirect } from "next/navigation";
import { can } from "@/domain/permissions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { listAudit } from "@/server/services/settings";

export const metadata = { title: "Audit trail" };

export default async function AuditPage() {
  const actor = await requireSession();
  if (!can(actor, "audit:view")) redirect("/me");
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const events = await listAudit(db, actor);
  return (
    <>
      <PageHeader title="Audit trail" description="Every Assignment, trade, request, publish and setting change — who, what and when. Append-only." />
      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>What</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{e.createdAt.toLocaleString("en-US", { timeZone: dept.timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.actorName}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[11px]">{e.action}</Badge></TableCell>
                  <TableCell className="min-w-64 whitespace-normal">{e.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

// Reads the session and the clock on every request (ADR-0008).
export const instant = false;
