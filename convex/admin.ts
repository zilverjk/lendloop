import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./lib/audit";
import { requireAdmin } from "./lib/authz";
import { log } from "./lib/log";
import { recentActivity } from "./loans";
import { roleValidator } from "./schema";

/** CLI-only bootstrap: `npx convex run admin:setRole '{"email":"a@b.c","role":"admin"}'`. */
export const setRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  handler: async (ctx, { email, role }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "No user with that email" });
    await ctx.db.patch(user._id, { role });
    log.info("admin.role_set", { userId: user._id, role });
    return { userId: user._id, role };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(500);
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      role: u.role,
      trustedLender: u.trustedLender,
      createdAt: u.createdAt,
    }));
  },
});

export const listAllLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(200);
    return await Promise.all(
      loans.map(async (l) => {
        const [tool, owner, borrower, activity] = await Promise.all([
          ctx.db.get(l.toolId),
          ctx.db.get(l.ownerId),
          ctx.db.get(l.borrowerId),
          recentActivity(ctx, l._id),
        ]);
        return {
          _id: l._id,
          toolId: l.toolId,
          toolName: tool?.name ?? "(removed)",
          ownerName: owner?.name ?? "Unknown",
          borrowerName: borrower?.name ?? "Unknown",
          status: l.status,
          startDate: l.startDate,
          endDate: l.endDate,
          createdAt: l.createdAt,
          activity,
        };
      }),
    );
  },
});

/** Queries cannot write, so the admin UI calls this once when it opens the all-loans view. */
export const recordLoansViewed = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    await writeAudit(ctx, admin._id, "loan.viewed_all", "loan", "*");
  },
});

export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("auditLogs").withIndex("by_createdAt").order("desc").take(100);
    return await Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        actorName: (await ctx.db.get(r.actorId))?.name ?? "Unknown",
      })),
    );
  },
});

export const removeTool = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const admin = await requireAdmin(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError({ code: "NOT_FOUND", message: "Tool not found" });
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    const now = Date.now();
    let cancelled = 0;
    for (const l of loans) {
      if (l.status === "pending" || l.status === "approved") {
        await ctx.db.patch(l._id, { status: "cancelled", updatedAt: now });
        cancelled++;
      }
    }
    await ctx.db.delete(toolId);
    await writeAudit(ctx, admin._id, "tool.removed", "tool", toolId, {
      ownerId: tool.ownerId,
      cancelledLoans: cancelled,
    });
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    await ctx.db.patch(userId, { trustedLender: trusted });
    await writeAudit(
      ctx,
      admin._id,
      trusted ? "user.trusted_set" : "user.trusted_unset",
      "user",
      userId,
    );
  },
});
