import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

// ---------------------------------------------------------------------------
// Pure decision functions (unit-testable, no ctx)
// ---------------------------------------------------------------------------
type U = { _id: string; role: "user" | "admin" };

export function isAdmin(user: U): boolean {
  return user.role === "admin";
}
export function canEditTool(user: U, tool: { ownerId: string }): boolean {
  return tool.ownerId === user._id;
}
/** Owner may delete unless an approved (active) loan exists. */
export function canDeleteTool(
  user: U,
  tool: { ownerId: string },
  hasActiveLoan: boolean,
): boolean {
  return tool.ownerId === user._id && !hasActiveLoan;
}
export function canBorrow(user: U, tool: { ownerId: string }): boolean {
  return tool.ownerId !== user._id;
}
export function canDecideLoan(user: U, loan: { ownerId: string; status: string }): boolean {
  return loan.ownerId === user._id && loan.status === "pending";
}
export function canMarkReturned(
  user: U,
  loan: { ownerId: string; borrowerId: string; status: string },
): boolean {
  return (
    (loan.ownerId === user._id || loan.borrowerId === user._id) && loan.status === "approved"
  );
}
export function canCancel(user: U, loan: { borrowerId: string; status: string }): boolean {
  return loan.borrowerId === user._id && loan.status === "pending";
}
export function isLoanParty(user: U, loan: { ownerId: string; borrowerId: string }): boolean {
  return loan.ownerId === user._id || loan.borrowerId === user._id;
}

// ---------------------------------------------------------------------------
// ctx helpers
// ---------------------------------------------------------------------------
export function forbidden(message = "Not allowed"): ConvexError<{ code: "FORBIDDEN"; message: string }> {
  return new ConvexError({ code: "FORBIDDEN", message });
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: "Call users.store after sign-in",
    });
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdmin(user)) throw forbidden("Admin only");
  return user;
}

export function assertToolOwner(user: Doc<"users">, tool: Doc<"tools">): void {
  if (!canEditTool(user, tool)) throw forbidden("Only the owner can modify this tool");
}

export function assertLoanParty(user: Doc<"users">, loan: Doc<"loans">): void {
  if (!isLoanParty(user, loan)) throw forbidden("Not a party to this loan");
}
