import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  assertLoanParty,
  canBorrow,
  canCancel,
  canDecideLoan,
  canMarkReturned,
  forbidden,
  requireUser,
} from "./lib/authz";
import { log } from "./lib/log";
import { rangesOverlap, todayIso, validateLoanDates } from "./lib/validation";
import { enqueueLoanEvent } from "./notifications";

const notFound = (what: string) => new ConvexError({ code: "NOT_FOUND", message: `${what} not found` });
const conflict = (message: string) => new ConvexError({ code: "CONFLICT", message });

async function approvedLoansFor(ctx: QueryCtx | MutationCtx, toolId: Id<"tools">) {
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", toolId))
    .collect();
  return loans.filter((l) => l.status === "approved");
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw notFound("Tool");
    if (!canBorrow(user, tool)) throw forbidden("You cannot borrow your own tool");
    validateLoanDates(args.startDate, args.endDate, todayIso(Date.now()));
    const approved = await approvedLoansFor(ctx, tool._id);
    if (approved.some((l) => rangesOverlap(l, args))) {
      throw conflict("Tool is already booked for those dates");
    }
    const now = Date.now();
    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      ownerId: tool.ownerId,
      borrowerId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await enqueueLoanEvent(ctx, "loan.requested", loanId);
    log.info("loan.requested", { loanId });
    return loanId;
  },
});

async function loadLoan(ctx: MutationCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  if (!loan) throw notFound("Loan");
  return loan;
}

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (!canDecideLoan(user, loan)) throw forbidden("Only the owner can approve a pending request");
    const approved = await approvedLoansFor(ctx, loan.toolId);
    if (approved.some((l) => rangesOverlap(l, loan))) {
      throw conflict("Dates overlap with an approved loan");
    }
    const now = Date.now();
    await ctx.db.patch(loan._id, { status: "approved", updatedAt: now });
    await ctx.db.patch(loan.toolId, { isAvailable: false, updatedAt: now });
    await enqueueLoanEvent(ctx, "loan.approved", loan._id);
    log.info("loan.approved", { loanId });
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (!canDecideLoan(user, loan)) throw forbidden("Only the owner can decline a pending request");
    await ctx.db.patch(loan._id, { status: "declined", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, "loan.declined", loan._id);
    log.info("loan.declined", { loanId });
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await loadLoan(ctx, loanId);
    if (!canCancel(user, loan)) throw forbidden("Only the borrower can cancel a pending request");
    await ctx.db.patch(loan._id, { status: "cancelled", updatedAt: Date.now() });
    await enqueueLoanEvent(ctx, "loan.cancelled", loan._id);
    log.info("loan.cancelled", { loanId });
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const user = await requireUser(ctx);
    const loan = await loadLoan(ctx, loanId);
    assertLoanParty(user, loan);
    if (!canMarkReturned(user, loan)) throw conflict("Only approved loans can be marked returned");
    const now = Date.now();
    await ctx.db.patch(loan._id, { status: "returned", returnedAt: now, updatedAt: now });
    const stillOut = (await approvedLoansFor(ctx, loan.toolId)).some((l) => l._id !== loan._id);
    if (!stillOut && (await ctx.db.get(loan.toolId))) {
      await ctx.db.patch(loan.toolId, { isAvailable: true, updatedAt: now });
    }
    await enqueueLoanEvent(ctx, "loan.returned", loan._id);
    log.info("loan.returned", { loanId });
  },
});

const ACTIVITY_LIMIT = 3;

export async function recentActivity(ctx: QueryCtx, loanId: Id<"loans">) {
  const events = await ctx.db
    .query("automationEvents")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(ACTIVITY_LIMIT);
  return events.map((e) => ({ kind: e.kind, createdAt: e.createdAt }));
}

async function viewLoan(ctx: QueryCtx, loan: Doc<"loans">, counterpartyId: Id<"users">) {
  const [tool, other, activity] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(counterpartyId),
    recentActivity(ctx, loan._id),
  ]);
  return {
    _id: loan._id,
    toolId: loan.toolId,
    toolName: tool?.name ?? "(removed)",
    status: loan.status,
    startDate: loan.startDate,
    endDate: loan.endDate,
    createdAt: loan.createdAt,
    returnedAt: loan.returnedAt,
    counterpartyName: other?.name ?? "Unknown",
    activity,
  };
}

/** Loans I requested as borrower. */
export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => viewLoan(ctx, l, l.ownerId)));
  },
});

/** Requests on tools I own. */
export const incomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => viewLoan(ctx, l, l.borrowerId)));
  },
});
