import { and, desc, eq, or } from "drizzle-orm";
import { openTrade, previewTrade, transition, type Trade, type TradeEvent } from "@/domain/trades";
import { schema, type DB } from "../db";
import { getDepartment, loadSnapshot, type Snapshot } from "../repo";
import { audit, DomainError, notify, require, staffNames, type Actor } from "./common";

const { tradeRequests, assignments, shifts, schedulePeriods } = schema;
type TradeRow = typeof tradeRequests.$inferSelect;

const toTrade = (r: TradeRow): Trade => ({
  kind: r.kind, status: r.status, requesterId: r.requesterId, shiftId: r.shiftId,
  counterpartyId: r.counterpartyId ?? undefined, counterpartyShiftId: r.counterpartyShiftId ?? undefined,
});

async function snapshotFor(db: DB, actor: Actor, shiftIds: string[]): Promise<Snapshot> {
  const rows = await db.select({ date: shifts.date, status: schedulePeriods.status }).from(shifts)
    .innerJoin(schedulePeriods, eq(shifts.periodId, schedulePeriods.id))
    .where(and(eq(shifts.departmentId, actor.departmentId), or(...shiftIds.map((id) => eq(shifts.id, id)))));
  if (rows.length !== new Set(shiftIds).size) throw new DomainError("Shift not found");
  if (rows.some((r) => r.status !== "published")) throw new DomainError("Trades are only possible on published schedules");
  const dates = rows.map((r) => r.date).sort();
  return loadSnapshot(db, actor.departmentId, dates[0], dates[dates.length - 1]);
}

async function applyChange(db: DB, actor: Actor, change: NonNullable<ReturnType<typeof previewTrade>["change"]>) {
  await db.transaction(async (tx) => {
    for (const r of change.remove) {
      await tx.delete(assignments).where(and(eq(assignments.shiftId, r.shiftId), eq(assignments.staffMemberId, r.staffId)));
    }
    if (change.add.length) {
      await tx.insert(assignments).values(change.add.map((a) => ({ organizationId: actor.organizationId, shiftId: a.shiftId, staffMemberId: a.staffId, source: "trade" as const })));
    }
  });
}

function describe(t: Trade, names: Map<string, string>, labels: Map<string, string>) {
  const who = (id?: string) => (id ? names.get(id) ?? "someone" : "anyone");
  if (t.kind === "pickup") return `${who(t.requesterId)} picked up ${labels.get(t.shiftId)}`;
  if (t.kind === "giveaway") return `${who(t.requesterId)} gave away ${labels.get(t.shiftId)}${t.counterpartyId ? ` to ${who(t.counterpartyId)}` : ""}`;
  return `${who(t.requesterId)} swaps ${labels.get(t.shiftId)} for ${who(t.counterpartyId)}'s ${labels.get(t.counterpartyShiftId!)}`;
}

const shiftLabels = (snap: Snapshot) => new Map(snap.shifts.map((s) => [s.id, `${s.label} ${s.date}`]));

/** Rule check shown before a Staff Member sends a trade. */
export async function previewForActor(db: DB, actor: Actor, input: Omit<Trade, "status">) {
  const snap = await snapshotFor(db, actor, [input.shiftId, input.counterpartyShiftId].filter((x): x is string => !!x));
  return previewTrade({ ...input, status: "open" }, snap.ctx);
}

export async function createTrade(db: DB, actor: Actor, input: { kind: Trade["kind"]; shiftId: string; counterpartyId?: string; counterpartyShiftId?: string; note?: string }) {
  if (!actor.staffMemberId) throw new DomainError("Only Staff Members can trade");
  const dept = await getDepartment(db, actor.departmentId);
  const draft = { kind: input.kind, requesterId: actor.staffMemberId, shiftId: input.shiftId, counterpartyId: input.counterpartyId, counterpartyShiftId: input.counterpartyShiftId };
  const snap = await snapshotFor(db, actor, [input.shiftId, input.counterpartyShiftId].filter((x): x is string => !!x));
  const res = openTrade(draft, snap.ctx, dept.settings.tradePolicy);
  if (!res.ok) throw new DomainError(res.error, res.violations);
  const [row] = await db.insert(tradeRequests).values({
    organizationId: actor.organizationId, departmentId: actor.departmentId, kind: res.trade.kind, status: res.trade.status,
    requesterId: res.trade.requesterId, shiftId: res.trade.shiftId, counterpartyId: res.trade.counterpartyId ?? null,
    counterpartyShiftId: res.trade.counterpartyShiftId ?? null, note: input.note ?? null,
  }).returning();
  if (res.ok && res.apply) await applyChange(db, actor, res.apply);
  const names = await staffNames(db, [actor.staffMemberId, input.counterpartyId].filter((x): x is string => !!x));
  const summary = describe(res.trade, names, shiftLabels(snap));
  await audit(db, actor, `trade.${res.trade.kind}.${res.trade.status}`, summary, { tradeId: row.id });
  if (input.kind === "swap" && input.counterpartyId) {
    await notify(db, actor.organizationId, [input.counterpartyId], { category: "trade", title: "Swap request", body: summary, href: "/trades" });
  }
  return { trade: row, violations: res.violations };
}

export async function actOnTrade(db: DB, actor: Actor, tradeId: string, event: "accept" | "decline" | "withdraw" | "approve" | "reject") {
  const [row] = await db.select().from(tradeRequests).where(and(eq(tradeRequests.id, tradeId), eq(tradeRequests.departmentId, actor.departmentId)));
  if (!row) throw new DomainError("Trade not found");
  if (event === "approve" || event === "reject") require(actor, "trade:approve");
  else if (!actor.staffMemberId) throw new DomainError("Only Staff Members can do that");
  const dept = await getDepartment(db, actor.departmentId);
  const trade = toTrade(row);
  const snap = await snapshotFor(db, actor, [trade.shiftId, trade.counterpartyShiftId].filter((x): x is string => !!x));
  const ev: TradeEvent = event === "approve" || event === "reject" ? { type: event } : { type: event, by: actor.staffMemberId! };
  const res = transition(trade, ev, snap.ctx, dept.settings.tradePolicy);
  if (!res.ok) throw new DomainError(res.error, res.violations);
  if (res.apply) await applyChange(db, actor, res.apply);
  await db.update(tradeRequests).set({ status: res.trade.status, counterpartyId: res.trade.counterpartyId ?? null, updatedAt: new Date() }).where(eq(tradeRequests.id, tradeId));
  const parties = [res.trade.requesterId, res.trade.counterpartyId].filter((x): x is string => !!x);
  const names = await staffNames(db, parties);
  const summary = describe(res.trade, names, shiftLabels(snap));
  await audit(db, actor, `trade.${event}`, `${summary} — ${res.trade.status}`, { tradeId });
  await notify(db, actor.organizationId, parties.filter((p) => p !== actor.staffMemberId), {
    category: "trade", title: `Trade ${res.trade.status}`, body: summary, href: "/trades",
  });
  return { status: res.trade.status, violations: res.violations };
}

export async function listTrades(db: DB, actor: Actor) {
  return db.select().from(tradeRequests).where(eq(tradeRequests.departmentId, actor.departmentId)).orderBy(desc(tradeRequests.createdAt));
}

export interface BoardItem {
  id: string;
  kind: Trade["kind"];
  status: Trade["status"];
  note: string | null;
  requester: string;
  counterparty: string | null;
  shift: { id: string; label: string; date: string; startMinute: number; endMinute: number; onCall: boolean } | null;
  counterpartyShift: { id: string; label: string; date: string; startMinute: number; endMinute: number; onCall: boolean } | null;
  /** For the viewer: Hard/Soft Violations taking this would cause. */
  violations: import("@/domain/types").Violation[];
  canTake: boolean;
  createdAt: Date;
}

/** Everything the trade board shows the viewer: what involves them, what they can take, what awaits approval. */
export async function tradeBoard(db: DB, actor: Actor, today: string) {
  const { addDays } = await import("@/domain/time");
  const snap = await loadSnapshot(db, actor.departmentId, today, addDays(today, 120), { publishedOnly: true });
  const rows = (await listTrades(db, actor)).filter((r) => snap.shifts.some((s) => s.id === r.shiftId) || r.status !== "open");
  const names = await staffNames(db, [...new Set(rows.flatMap((r) => [r.requesterId, r.counterpartyId]).filter((x): x is string => !!x))]);
  const byId = new Map(snap.shifts.map((s) => [s.id, s]));
  const view = (id: string | null) => {
    const s = id ? byId.get(id) : undefined;
    return s ? { id: s.id, label: s.label, date: s.date, startMinute: s.startMinute, endMinute: s.endMinute, onCall: s.onCall } : null;
  };
  const me = actor.staffMemberId;
  const items: BoardItem[] = rows.map((r) => {
    const t = toTrade(r);
    let violations: BoardItem["violations"] = [];
    let canTake = false;
    if (me && r.status === "open" && r.kind === "giveaway" && r.requesterId !== me && byId.has(r.shiftId)) {
      const p = previewTrade({ ...t, counterpartyId: me }, snap.ctx);
      violations = p.violations;
      canTake = !p.error && !p.violations.some((v) => v.severity === "hard");
    }
    if (me && r.status === "open" && r.kind === "swap" && r.counterpartyId === me) {
      const p = previewTrade(t, snap.ctx);
      violations = p.violations;
      canTake = !p.error && !p.violations.some((v) => v.severity === "hard");
    }
    return {
      id: r.id, kind: r.kind, status: r.status, note: r.note, requester: names.get(r.requesterId) ?? "?",
      counterparty: r.counterpartyId ? names.get(r.counterpartyId) ?? "?" : null,
      shift: view(r.shiftId), counterpartyShift: view(r.counterpartyShiftId), violations, canTake, createdAt: r.createdAt,
    };
  });
  const gaps = me
    ? snap.shifts
        .filter((s) => s.date >= today && s.date <= addDays(today, 60))
        .filter((s) => snap.ctx.assignments.filter((a) => a.shiftId === s.id).length < s.headcount)
        .map((s) => ({ shift: view(s.id)!, violations: (previewTrade({ kind: "pickup", status: "open", requesterId: me, shiftId: s.id }, snap.ctx)).violations }))
        .filter((g) => !g.violations.some((v) => v.severity === "hard"))
    : [];
  const myShifts = me
    ? snap.shifts.filter((s) => s.date >= today && snap.ctx.assignments.some((a) => a.shiftId === s.id && a.staffId === me)).map((s) => view(s.id)!)
    : [];
  const mine = rows.map((r, i) => ({ r, item: items[i] }));
  return {
    incoming: mine.filter(({ r }) => r.status === "open" && r.kind === "swap" && r.counterpartyId === me).map((x) => x.item),
    giveaways: mine.filter(({ r }) => r.status === "open" && r.kind === "giveaway" && r.requesterId !== me && byId.has(r.shiftId)).map((x) => x.item),
    myTrades: mine.filter(({ r }) => r.requesterId === me || (r.counterpartyId === me && r.status !== "open")).map((x) => x.item),
    awaitingApproval: mine.filter(({ r }) => r.status === "accepted").map((x) => x.item),
    gaps,
    myShifts,
    staff: snap.ctx.staff.filter((s) => s.id !== me).map((s) => ({ id: s.id, name: s.name })),
    colleagueShifts: snap.shifts.filter((s) => s.date >= today).flatMap((s) =>
      snap.ctx.assignments.filter((a) => a.shiftId === s.id && a.staffId !== me).map((a) => ({ staffId: a.staffId, shift: view(s.id)! })),
    ),
  };
}
