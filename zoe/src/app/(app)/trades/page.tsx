import { currentInstant } from "@/server/clock";
import { can } from "@/domain/permissions";
import { instantToLocalDate } from "@/domain/time";
import { PageHeader } from "@/components/page-header";
import { NewTrade, TradeCard, PickupGap } from "@/components/trades";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/server/db";
import { getDepartment } from "@/server/repo";
import { requireSession } from "@/server/session";
import { tradeBoard } from "@/server/services/trades";

export const metadata = { title: "Trades" };

export default async function TradesPage() {
  const actor = await requireSession();
  const db = await getDb();
  const dept = await getDepartment(db, actor.departmentId);
  const today = instantToLocalDate(currentInstant(), dept.timeZone);
  const board = await tradeBoard(db, actor, today);
  const approver = can(actor, "trade:approve");
  const auto = dept.settings.tradePolicy === "auto";

  return (
    <>
      <PageHeader
        title="Trades"
        description={auto
          ? "Swaps, giveaways and pickups are checked against every Rule instantly. If nothing breaks, they're approved on the spot."
          : "Trades are checked against every Rule instantly, then a scheduler approves them."}
      >
        {actor.staffMemberId && <NewTrade myShifts={board.myShifts} colleagueShifts={board.colleagueShifts} staff={board.staff} />}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        {approver && (
          <Section title="Awaiting your approval" count={board.awaitingApproval.length} description="Accepted by both sides and rule-checked.">
            {board.awaitingApproval.map((t) => <TradeCard key={t.id} item={t} mode="approve" />)}
          </Section>
        )}
        {actor.staffMemberId && (
          <>
            <Section title="Asked of you" count={board.incoming.length} description="Swaps colleagues proposed to you.">
              {board.incoming.map((t) => <TradeCard key={t.id} item={t} mode="incoming" />)}
            </Section>
            <Section title="Up for grabs" count={board.giveaways.length} description="Giveaways from colleagues. Greyed-out ones would break a Hard Rule for you.">
              {board.giveaways.map((t) => <TradeCard key={t.id} item={t} mode="take" />)}
            </Section>
            <Section title="Open Shifts you can pick up" count={board.gaps.length} description="Coverage Gaps in the next 60 days that you're eligible for.">
              {board.gaps.slice(0, 30).map((g) => <PickupGap key={g.shift.id} shift={g.shift} violations={g.violations} />)}
            </Section>
            <Section title="Your trades" count={board.myTrades.length}>
              {board.myTrades.map((t) => <TradeCard key={t.id} item={t} mode="mine" />)}
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, description, count, children }: { title: string; description?: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{title}<Badge variant="secondary">{count}</Badge></CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{count === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : children}</CardContent>
    </Card>
  );
}

// Reads the session and the clock on every request, so the page blocks instead of prerendering a shell.
export const instant = false;
