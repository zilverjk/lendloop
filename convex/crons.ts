import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { log } from "./lib/log";

const DAY_MS = 24 * 60 * 60 * 1000;

export const pruneReplay = internalMutation({
  args: { nowMs: v.optional(v.number()) },
  handler: async (ctx, { nowMs }) => {
    const cutoff = (nowMs ?? Date.now()) - DAY_MS;
    const old = await ctx.db
      .query("webhookReplay")
      .withIndex("by_receivedAt", (q) => q.lt("receivedAt", cutoff))
      .take(500);
    for (const r of old) await ctx.db.delete(r._id);
    if (old.length) log.info("webhookReplay.pruned", { count: old.length });
    return old.length;
  },
});

const crons = cronJobs();
crons.interval("prune webhook replay nonces", { hours: 1 }, internal.crons.pruneReplay, {});
export default crons;
