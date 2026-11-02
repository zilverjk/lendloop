import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { log } from "./log";

export async function writeAudit(
  ctx: MutationCtx,
  actor: Id<"users"> | { label: string },
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, string | number | boolean> = {},
): Promise<void> {
  const actorFields = typeof actor === "string" ? { actorId: actor } : { actorLabel: actor.label };
  await ctx.db.insert("auditLogs", {
    ...actorFields,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: Date.now(),
  });
  log.info("audit", { action, targetType, targetId, ...actorFields });
}
