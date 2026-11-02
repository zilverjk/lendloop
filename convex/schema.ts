import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const categoryValidator = v.union(
  v.literal("power_tools"),
  v.literal("hand_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("sports"),
  v.literal("other"),
);

export const conditionValidator = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);

export const loanStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
  v.literal("cancelled"),
);

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));

export const automationKindValidator = v.union(
  v.literal("notification_sent"),
  v.literal("reminder_sent"),
  v.literal("automation_failed"),
);

export const outboundTypeValidator = v.union(
  v.literal("loan.requested"),
  v.literal("loan.approved"),
  v.literal("loan.declined"),
  v.literal("loan.returned"),
  v.literal("loan.cancelled"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role: roleValidator,
    trustedLender: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    isAvailable: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"])
    .index("by_available", ["isAvailable"]),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_status_endDate", ["status", "endDate"]),

  automationEvents: defineTable({
    loanId: v.optional(v.id("loans")),
    kind: automationKindValidator,
    channel: v.string(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    detail: v.optional(v.string()),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_loan", ["loanId"]),

  auditLogs: defineTable({
    // Absent for system actions (e.g. CLI bootstrap); actorLabel then names the source.
    actorId: v.optional(v.id("users")),
    actorLabel: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.any(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  webhookReplay: defineTable({
    nonce: v.string(),
    receivedAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_receivedAt", ["receivedAt"]),

  outboundEvents: defineTable({
    eventId: v.string(),
    type: outboundTypeValidator,
    loanId: v.id("loans"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    // Overrides the default recipient (e.g. admin tool removal notifies the borrower).
    audience: v.optional(v.union(v.literal("owner"), v.literal("borrower"))),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status_createdAt", ["status", "createdAt"]),
});
