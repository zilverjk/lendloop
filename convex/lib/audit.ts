import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { log } from "./log";

export async function writeAudit(
  ctx: MutationCtx,
  actorId: Id<"users">,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, string | number | boolean> = {},
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: Date.now(),
  });
  log.info("audit", { action, targetType, targetId, actorId });
}
