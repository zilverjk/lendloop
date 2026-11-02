import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertToolOwner, canDeleteTool, requireUser } from "./lib/authz";
import { log } from "./lib/log";
import { validateDescription, validateToolName } from "./lib/validation";
import { categoryValidator, conditionValidator } from "./schema";

/** Unauthenticated: only id, name and category of available tools. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_available", (q) => q.eq("isAvailable", true))
      .take(100);
    return tools.map((t) => ({ _id: t._id, name: t.name, category: t.category }));
  },
});

export const list = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    await requireUser(ctx);
    const tools: Doc<"tools">[] = category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", category))
          .take(200)
      : await ctx.db.query("tools").take(200);
    return await Promise.all(
      tools.map(async (t) => {
        const owner = await ctx.db.get(t.ownerId);
        return {
          _id: t._id,
          name: t.name,
          category: t.category,
          condition: t.condition,
          description: t.description,
          isAvailable: t.isAvailable,
          ownerId: t.ownerId,
          owner: { name: owner?.name ?? "Unknown", trustedLender: owner?.trustedLender ?? false },
        };
      }),
    );
  },
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const user = await requireUser(ctx);
    const t = await ctx.db.get(toolId);
    if (!t) return null;
    return {
      _id: t._id,
      name: t.name,
      category: t.category,
      condition: t.condition,
      description: t.description,
      isAvailable: t.isAvailable,
      isOwner: t.ownerId === user._id,
    };
  },
});

export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .take(200);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("tools", {
      ownerId: user._id,
      name: validateToolName(args.name),
      category: args.category,
      condition: args.condition,
      description: validateDescription(args.description),
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    });
    log.info("tool.created", { toolId: id });
    return id;
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    category: v.optional(categoryValidator),
    condition: v.optional(conditionValidator),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new ConvexError({ code: "NOT_FOUND", message: "Tool not found" });
    assertToolOwner(user, tool);
    await ctx.db.patch(tool._id, {
      ...(args.name !== undefined && { name: validateToolName(args.name) }),
      ...(args.category !== undefined && { category: args.category }),
      ...(args.condition !== undefined && { condition: args.condition }),
      ...(args.description !== undefined && { description: validateDescription(args.description) }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError({ code: "NOT_FOUND", message: "Tool not found" });
    assertToolOwner(user, tool);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    const hasActive = loans.some((l) => l.status === "approved");
    if (!canDeleteTool(user, tool, hasActive)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Tool has an active loan and cannot be deleted",
      });
    }
    const now = Date.now();
    for (const l of loans) {
      if (l.status === "pending") await ctx.db.patch(l._id, { status: "cancelled", updatedAt: now });
    }
    await ctx.db.delete(toolId);
    log.info("tool.deleted", { toolId });
  },
});
