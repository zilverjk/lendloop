import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { log } from "./lib/log";
import { buildOverdueItem } from "./lib/payload";
import { redactMessage } from "./lib/redact";
import { daysBetween } from "./lib/validation";

/** Store a nonce; returns false if it was already seen (replay). */
export async function claimNonce(ctx: MutationCtx, nonce: string): Promise<boolean> {
  const seen = await ctx.db
    .query("webhookReplay")
    .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
    .first();
  if (seen) return false;
  await ctx.db.insert("webhookReplay", { nonce, receivedAt: Date.now() });
  return true;
}

export const checkNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => ({ fresh: await claimNonce(ctx, nonce) }),
});

const OVERDUE_CAP = 200;

export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_endDate", (q) => q.eq("status", "approved").lt("endDate", today))
      .take(OVERDUE_CAP);
    if (loans.length === OVERDUE_CAP) log.warn("overdue.cap_hit", { cap: OVERDUE_CAP });
    const items = [];
    for (const l of loans) {
      // Skip loans already reminded today (manual run + cron on the same day).
      const sent = await ctx.db
        .query("automationEvents")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", `reminder:${l._id}:${today}`))
        .first();
      if (sent?.kind === "reminder_sent") continue;
      const [tool, borrower] = await Promise.all([ctx.db.get(l.toolId), ctx.db.get(l.borrowerId)]);
      if (!tool || !borrower) continue;
      items.push(buildOverdueItem(l, daysBetween(l.endDate, today), tool, borrower));
    }
    return items;
  },
});

async function findEvent(ctx: MutationCtx, idempotencyKey: string) {
  return await ctx.db
    .query("automationEvents")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .first();
}

/** A failed event may be upgraded in place by a later "sent" report; nothing else is. */
async function upgradeIfFailed(
  ctx: MutationCtx,
  existing: NonNullable<Awaited<ReturnType<typeof findEvent>>>,
  status: "sent" | "failed",
  sentKind: "reminder_sent" | "notification_sent",
  channel: string,
): Promise<boolean> {
  if (status !== "sent" || existing.kind !== "automation_failed") return false;
  await ctx.db.patch(existing._id, { kind: sentKind, channel, detail: undefined, createdAt: Date.now() });
  return true;
}

export const recordReminder = internalMutation({
  args: {
    idempotencyKey: v.string(),
    loanId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.string(),
  },
  handler: async (ctx, a) => {
    const loanId = ctx.db.normalizeId("loans", a.loanId);
    if (!loanId || !(await ctx.db.get(loanId))) return { result: "not_found" as const };
    const existing = await findEvent(ctx, a.idempotencyKey);
    if (existing) {
      const upgraded = await upgradeIfFailed(ctx, existing, a.status, "reminder_sent", a.channel);
      return { result: upgraded ? ("recorded" as const) : ("duplicate" as const) };
    }
    await ctx.db.insert("automationEvents", {
      loanId,
      kind: a.status === "sent" ? "reminder_sent" : "automation_failed",
      channel: a.channel,
      idempotencyKey: a.idempotencyKey,
      createdAt: Date.now(),
      detail: a.status === "failed" ? "reminder failed" : undefined,
    });
    await claimNonce(ctx, a.idempotencyKey);
    return { result: "recorded" as const };
  },
});

export const recordNotification = internalMutation({
  args: {
    idempotencyKey: v.string(),
    eventId: v.string(),
    loanId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.string(),
  },
  handler: async (ctx, a) => {
    const loanId = ctx.db.normalizeId("loans", a.loanId);
    const outbound = await ctx.db
      .query("outboundEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", a.eventId))
      .first();
    if (!loanId || !outbound || outbound.loanId !== loanId) return { result: "not_found" as const };
    const now = Date.now();
    const existing = await findEvent(ctx, a.idempotencyKey);
    if (existing) {
      const upgraded = await upgradeIfFailed(ctx, existing, a.status, "notification_sent", a.channel);
      if (!upgraded) return { result: "duplicate" as const };
      await ctx.db.patch(outbound._id, { acknowledgedAt: now });
      return { result: "recorded" as const };
    }
    await ctx.db.insert("automationEvents", {
      loanId,
      kind: a.status === "sent" ? "notification_sent" : "automation_failed",
      channel: a.channel,
      idempotencyKey: a.idempotencyKey,
      createdAt: now,
      detail: a.status === "failed" ? "notification failed" : undefined,
    });
    if (a.status === "sent") await ctx.db.patch(outbound._id, { acknowledgedAt: now });
    await claimNonce(ctx, a.idempotencyKey);
    return { result: "recorded" as const };
  },
});

export const recordFailure = internalMutation({
  args: {
    idempotencyKey: v.string(),
    workflow: v.string(),
    loanId: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, a) => {
    if (await findEvent(ctx, a.idempotencyKey)) return { result: "duplicate" as const };
    const loanId = a.loanId ? (ctx.db.normalizeId("loans", a.loanId) ?? undefined) : undefined;
    await ctx.db.insert("automationEvents", {
      loanId,
      kind: "automation_failed",
      channel: "n8n",
      idempotencyKey: a.idempotencyKey,
      createdAt: Date.now(),
      detail: redactMessage(`${a.workflow}: ${a.message}`).slice(0, 300),
    });
    await claimNonce(ctx, a.idempotencyKey);
    return { result: "recorded" as const };
  },
});
