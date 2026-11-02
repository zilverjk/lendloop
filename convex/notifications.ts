import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { SIGNATURE_HEADER, EVENT_ID_HEADER, signPayload } from "./lib/hmac";
import { log } from "./lib/log";
import { buildLoanEventPayload, type OutboundType } from "./lib/payload";
import { backoffMs, shouldRetry } from "./lib/retry";

const FETCH_TIMEOUT_MS = 10_000;

/** Insert an outbox row and schedule delivery. Call from loan mutations. */
export async function enqueueLoanEvent(
  ctx: MutationCtx,
  type: OutboundType,
  loanId: Id<"loans">,
): Promise<string> {
  const eventId = crypto.randomUUID();
  const outboundEventId = await ctx.db.insert("outboundEvents", {
    eventId,
    type,
    loanId,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { outboundEventId });
  return eventId;
}

export const getDeliveryData = internalQuery({
  args: { outboundEventId: v.id("outboundEvents") },
  handler: async (ctx, { outboundEventId }) => {
    const ev = await ctx.db.get(outboundEventId);
    if (!ev || ev.status !== "pending") return null;
    const loan = await ctx.db.get(ev.loanId);
    if (!loan) return null;
    const [tool, owner, borrower] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(loan.ownerId),
      ctx.db.get(loan.borrowerId),
    ]);
    // Tool may have been removed by an admin; fall back to a neutral label.
    if (!owner || !borrower) return null;
    return {
      payload: buildLoanEventPayload({
        eventId: ev.eventId,
        type: ev.type,
        occurredAt: ev.createdAt,
        loan,
        tool: { name: tool?.name ?? "a tool" },
        owner,
        borrower,
      }),
    };
  },
});

export const markSent = internalMutation({
  args: { outboundEventId: v.id("outboundEvents") },
  handler: async (ctx, { outboundEventId }) => {
    const ev = await ctx.db.get(outboundEventId);
    if (!ev || ev.status !== "pending") return;
    await ctx.db.patch(outboundEventId, { status: "sent", attempts: ev.attempts + 1 });
  },
});

export const recordFailure = internalMutation({
  args: {
    outboundEventId: v.id("outboundEvents"),
    error: v.string(),
    final: v.optional(v.boolean()),
  },
  handler: async (ctx, { outboundEventId, error, final }) => {
    const ev = await ctx.db.get(outboundEventId);
    if (!ev || ev.status !== "pending") return;
    const attempts = ev.attempts + 1;
    const lastError = error.slice(0, 200);
    if (!final && shouldRetry(attempts)) {
      await ctx.db.patch(outboundEventId, { attempts, lastError });
      await ctx.scheduler.runAfter(backoffMs(attempts), internal.notifications.deliver, {
        outboundEventId,
      });
      log.warn("notification.retry_scheduled", { eventId: ev.eventId, attempts });
      return;
    }
    await ctx.db.patch(outboundEventId, { status: "failed", attempts, lastError });
    await ctx.db.insert("automationEvents", {
      loanId: ev.loanId,
      kind: "automation_failed",
      channel: "n8n-webhook",
      idempotencyKey: `deliver-fail:${ev.eventId}`,
      createdAt: Date.now(),
      detail: `delivery failed after ${attempts} attempts`,
    });
    log.error("notification.failed", { eventId: ev.eventId, attempts, lastError });
  },
});

export const deliver = internalAction({
  args: { outboundEventId: v.id("outboundEvents") },
  handler: async (ctx, { outboundEventId }) => {
    const data = await ctx.runQuery(internal.notifications.getDeliveryData, { outboundEventId });
    if (!data) return;
    const url = process.env.N8N_WEBHOOK_URL;
    const secret = process.env.LENDLOOP_WEBHOOK_SECRET;
    if (!url || !secret) {
      log.warn("notification.not_configured", { eventId: data.payload.eventId });
      await ctx.runMutation(internal.notifications.recordFailure, {
        outboundEventId,
        error: "N8N_WEBHOOK_URL or LENDLOOP_WEBHOOK_SECRET not set",
        final: true,
      });
      return;
    }
    const body = JSON.stringify(data.payload);
    const signature = await signPayload(secret, body, Date.now() / 1000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SIGNATURE_HEADER]: signature,
          [EVENT_ID_HEADER]: data.payload.eventId,
          "Idempotency-Key": data.payload.eventId,
        },
        body,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        await ctx.runMutation(internal.notifications.markSent, { outboundEventId });
        log.info("notification.sent", { eventId: data.payload.eventId, type: data.payload.type });
      } else {
        await ctx.runMutation(internal.notifications.recordFailure, {
          outboundEventId,
          error: `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      await ctx.runMutation(internal.notifications.recordFailure, {
        outboundEventId,
        error: e instanceof Error ? e.name : "network_error",
      });
    }
  },
});
