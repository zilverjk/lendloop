import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

function displayName(name: string | undefined, email: string | undefined): string {
  const n = name?.trim();
  if (n) return n.slice(0, 80);
  const local = email?.split("@")[0]?.trim();
  return (local || "Member").slice(0, 80);
}

/** Upsert the caller's user row from their verified identity. Never touches role. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required" });
    }
    const name = displayName(identity.name, identity.email);
    const email = (identity.email ?? "").slice(0, 200);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      name,
      email,
      role: "user",
      trustedLender: false,
      createdAt: Date.now(),
    });
  },
});

/** Current user's own profile (null if not signed in / not stored yet). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});
