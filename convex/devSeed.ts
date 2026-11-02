import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { enqueueLoanEvent } from "./notifications";

/** Dev-only helpers for the n8n smoke test. Refuse to run unless ALLOW_DEV_SEED=true. */
function assertAllowed() {
  if (process.env.ALLOW_DEV_SEED !== "true") {
    throw new ConvexError({ code: "FORBIDDEN", message: "ALLOW_DEV_SEED is not enabled" });
  }
}

const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function upsertUser(ctx: MutationCtx, key: string, name: string, email: string) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", `devseed|${key}`))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("users", {
    tokenIdentifier: `devseed|${key}`,
    clerkUserId: `devseed_${key}`,
    name,
    email,
    role: "user",
    trustedLender: false,
    createdAt: Date.now(),
  });
}

/**
 * Creates owner + borrower + tool and one loan.
 * scenario "pending": a pending loan and queues the loan.requested notification.
 * scenario "overdue": an approved loan that ended `daysOverdue` days ago.
 */
export const seedLoan = internalMutation({
  args: {
    scenario: v.union(v.literal("pending"), v.literal("overdue")),
    daysOverdue: v.optional(v.number()),
  },
  handler: async (ctx, { scenario, daysOverdue }) => {
    assertAllowed();
    const owner = await upsertUser(ctx, "owner", "Olivia Owner", "olivia.owner@example.com");
    const borrower = await upsertUser(ctx, "borrower", "Ben Borrower", "ben.borrower@example.com");
    const now = Date.now();
    const toolId = await ctx.db.insert("tools", {
      ownerId: owner,
      name: `Seed drill ${now}`,
      category: "power_tools",
      condition: "good",
      description: "Dev seed tool",
      isAvailable: scenario === "pending",
      createdAt: now,
      updatedAt: now,
    });
    const overdueBy = daysOverdue ?? 3;
    const loanId: Id<"loans"> = await ctx.db.insert("loans", {
      toolId,
      ownerId: owner,
      borrowerId: borrower,
      startDate: scenario === "pending" ? iso(now + DAY_MS) : iso(now - (overdueBy + 7) * DAY_MS),
      endDate: scenario === "pending" ? iso(now + 3 * DAY_MS) : iso(now - overdueBy * DAY_MS),
      status: scenario === "pending" ? "pending" : "approved",
      createdAt: now,
      updatedAt: now,
    });
    const eventId =
      scenario === "pending" ? await enqueueLoanEvent(ctx, "loan.requested", loanId) : null;
    return { loanId, eventId };
  },
});

/** Automation events (+ outbound delivery state) for one loan, for verification. */
export const loanActivity = internalQuery({
  args: { loanId: v.string() },
  handler: async (ctx, { loanId }) => {
    assertAllowed();
    const id = ctx.db.normalizeId("loans", loanId);
    if (!id) return { events: [], outbound: [] };
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", id))
      .take(50);
    const outbound = (await ctx.db.query("outboundEvents").order("desc").take(100)).filter(
      (o) => o.loanId === id,
    );
    return {
      events: events.map((e) => ({ kind: e.kind, key: e.idempotencyKey, channel: e.channel })),
      outbound: outbound.map((o) => ({
        status: o.status,
        attempts: o.attempts,
        acknowledged: o.acknowledgedAt !== undefined,
      })),
    };
  },
});

/** Recent automation_failed events not tied to a loan (n8n error handler). */
export const recentFailures = internalQuery({
  args: {},
  handler: async (ctx) => {
    assertAllowed();
    const rows = await ctx.db.query("automationEvents").order("desc").take(50);
    return rows
      .filter((e) => e.kind === "automation_failed" && e.idempotencyKey.startsWith("fail:"))
      .map((e) => ({ key: e.idempotencyKey, detail: e.detail }));
  },
});
