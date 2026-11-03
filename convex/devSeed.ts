import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
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
    return { loanId, toolId, eventId };
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

const TEST_TOOL_NAME = /^Seed drill \d+$/;
const CLEANUP_BATCH = 100; // tools per call; keeps reads well under Convex limits
const SCAN_LIMIT = 2000; // bounded scans for tables without a loan/target index

/**
 * Deletes seeded test tools and every row tied to them (loans, outboundEvents,
 * automationEvents, auditLogs). Users are kept. Only tools owned by `devseed|*` users are
 * ever deleted. With `toolIds` it targets exactly those; otherwise all tools named
 * "Seed drill <digits>". `dryRun` reports counts without deleting. If `more` is true, call again.
 */
export const cleanup = internalMutation({
  args: { toolIds: v.optional(v.array(v.string())), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { toolIds, dryRun }) => {
    assertAllowed();
    const isDevseedOwner = async (ownerId: Id<"users">) =>
      ((await ctx.db.get(ownerId))?.tokenIdentifier ?? "").startsWith("devseed|");

    const targets: Id<"tools">[] = [];
    let more = false;
    if (toolIds) {
      for (const raw of toolIds.slice(0, 500)) {
        const id = ctx.db.normalizeId("tools", raw);
        const tool = id ? await ctx.db.get(id) : null;
        if (id && tool && (await isDevseedOwner(tool.ownerId))) targets.push(id);
      }
    } else {
      const candidates = await ctx.db
        .query("tools")
        .withIndex("by_category", (q) => q.eq("category", "power_tools"))
        .take(1000);
      for (const tool of candidates) {
        if (!TEST_TOOL_NAME.test(tool.name) || !(await isDevseedOwner(tool.ownerId))) continue;
        if (targets.length >= CLEANUP_BATCH) {
          more = true;
          break;
        }
        targets.push(tool._id);
      }
    }

    const toolSet = new Set<string>(targets);
    const loanIds = new Set<Id<"loans">>();
    const loanDocs: Id<"loans">[] = [];
    for (const toolId of targets) {
      const loans = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", toolId))
        .take(500);
      for (const l of loans) {
        loanIds.add(l._id);
        loanDocs.push(l._id);
      }
    }

    const automation: Id<"automationEvents">[] = [];
    for (const loanId of loanIds) {
      const rows = await ctx.db
        .query("automationEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .take(500);
      automation.push(...rows.map((r) => r._id));
    }
    const outbound = loanIds.size
      ? (await ctx.db.query("outboundEvents").order("desc").take(SCAN_LIMIT))
          .filter((o) => loanIds.has(o.loanId))
          .map((o) => o._id)
      : [];
    const audit =
      toolSet.size || loanIds.size
        ? (await ctx.db.query("auditLogs").withIndex("by_createdAt").order("desc").take(SCAN_LIMIT))
            .filter((a) => toolSet.has(a.targetId) || loanIds.has(a.targetId as Id<"loans">))
            .map((a) => a._id)
        : [];

    const counts = {
      tools: targets.length,
      loans: loanDocs.length,
      outboundEvents: outbound.length,
      automationEvents: automation.length,
      auditLogs: audit.length,
    };
    if (!dryRun) {
      for (const id of [...outbound, ...automation, ...audit, ...loanDocs, ...targets]) {
        await ctx.db.delete(id);
      }
    }
    return { ...counts, dryRun: !!dryRun, more };
  },
});

const DEMO_NEIGHBOURS = [
  { key: "owner", name: "Olivia Owner", email: "olivia.owner@example.com" },
  { key: "marta", name: "Marta Gomez", email: "marta.gomez@example.com" },
  { key: "david", name: "David Lee", email: "david.lee@example.com" },
] as const;

const DEMO_TOOLS: {
  owner: (typeof DEMO_NEIGHBOURS)[number]["key"];
  name: string;
  category: Doc<"tools">["category"];
  condition: Doc<"tools">["condition"];
  description: string;
}[] = [
  { owner: "owner", name: "Cordless drill 18V", category: "power_tools", condition: "good", description: "18V drill/driver with two batteries, charger and a basic bit set." },
  { owner: "owner", name: "Orbital sander", category: "power_tools", condition: "fair", description: "Random orbital sander, 125 mm. Comes with a handful of sanding discs." },
  { owner: "marta", name: "Claw hammer and screwdriver set", category: "hand_tools", condition: "good", description: "Sturdy hammer plus a 12-piece screwdriver set in a small case." },
  { owner: "marta", name: "Lawn aerator", category: "garden", condition: "fair", description: "Manual spike aerator. Great for compacted lawns in spring." },
  { owner: "david", name: "Hedge trimmer", category: "garden", condition: "good", description: "Electric hedge trimmer with a 50 cm blade. Extension cord not included." },
  { owner: "david", name: "Stand mixer", category: "kitchen", condition: "new", description: "5 L stand mixer with whisk, dough hook and paddle attachments." },
  { owner: "marta", name: "4-person camping tent", category: "camping", condition: "good", description: "Three-season dome tent, pitches in ten minutes. Pegs and poles included." },
  { owner: "owner", name: "Carpet steam cleaner", category: "cleaning", condition: "fair", description: "Upright carpet cleaner. You supply the cleaning solution." },
  { owner: "david", name: "Pair of tennis rackets", category: "sports", condition: "worn", description: "Two adult rackets with a can of balls. Well loved but still playable." },
];

/** Idempotently inserts a small demo dataset (owner + name is the identity). */
export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertAllowed();
    const owners = new Map<string, Id<"users">>();
    for (const n of DEMO_NEIGHBOURS) owners.set(n.key, await upsertUser(ctx, n.key, n.name, n.email));
    let inserted = 0;
    for (const t of DEMO_TOOLS) {
      const ownerId = owners.get(t.owner)!;
      const existing = await ctx.db
        .query("tools")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(200);
      if (existing.some((e) => e.name === t.name)) continue;
      const now = Date.now();
      await ctx.db.insert("tools", {
        ownerId,
        name: t.name,
        category: t.category,
        condition: t.condition,
        description: t.description,
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }
    return { inserted, total: DEMO_TOOLS.length };
  },
});
