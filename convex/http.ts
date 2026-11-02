import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { SIGNATURE_HEADER, parseSignatureHeader, verifySignature } from "./lib/hmac";
import { log } from "./lib/log";
import {
  MAX_BODY_BYTES,
  parseAutomationFailure,
  parseNotificationStatus,
  parseReminderStatus,
  todayIso,
  type ParseResult,
} from "./lib/validation";

const http = httpRouter();

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Authed = { ok: true; body: string; signatureV1: string } | { ok: false; res: Response };

/** Size limit + HMAC + timestamp window. Replay checks are done by the caller. */
async function authenticate(request: Request, route: string): Promise<Authed> {
  const secret = process.env.N8N_INBOUND_SECRET;
  if (!secret) {
    log.error("inbound.not_configured", { route });
    return { ok: false, res: json(500, { error: "not_configured" }) };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, res: json(413, { error: "too_large" }) };
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return { ok: false, res: json(413, { error: "too_large" }) };
  }
  const header = request.headers.get(SIGNATURE_HEADER);
  const result = await verifySignature(secret, body, header, Math.floor(Date.now() / 1000));
  if (!result.ok) {
    log.warn("inbound.rejected", { route, reason: result.reason });
    return { ok: false, res: json(401, { error: "unauthorized" }) };
  }
  // Header already validated by verifySignature.
  const parsed = parseSignatureHeader(header);
  return { ok: true, body, signatureV1: parsed?.v1 ?? "" };
}

function parseJson<T>(body: string, parse: (raw: unknown) => ParseResult<T>): ParseResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
  return parse(raw);
}

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticate(request, "overdue-loans");
    if (!auth.ok) return auth.res;
    // A signature is unique per (timestamp, body); using it as the nonce means
    // a captured request cannot be replayed even if the nonce header is altered.
    const { fresh } = await ctx.runMutation(internal.automation.checkNonce, {
      nonce: `get:${auth.signatureV1}`,
    });
    if (!fresh) {
      log.warn("inbound.replay", { route: "overdue-loans" });
      return json(409, { error: "replay" });
    }
    const loans = await ctx.runQuery(internal.automation.overdueLoans, {
      today: todayIso(Date.now()),
    });
    log.info("inbound.overdue_loans", { count: loans.length });
    return json(200, { loans });
  }),
});

async function handlePost<T>(
  ctx: ActionCtx,
  request: Request,
  route: string,
  parse: (raw: unknown) => ParseResult<T>,
  run: (value: T) => Promise<{ result: "recorded" | "duplicate" | "not_found" }>,
): Promise<Response> {
  const auth = await authenticate(request, route);
  if (!auth.ok) return auth.res;
  const parsed = parseJson(auth.body, parse);
  if (!parsed.ok) {
    log.warn("inbound.invalid_body", { route, error: parsed.error });
    return json(400, { error: "invalid_body", detail: parsed.error });
  }
  const { result } = await run(parsed.value);
  log.info("inbound.processed", { route, result });
  if (result === "not_found") return json(404, { error: "not_found" });
  if (result === "duplicate") return json(200, { ok: true, duplicate: true });
  return json(200, { ok: true, duplicate: false });
}

http.route({
  path: "/n8n/reminder-status",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handlePost(ctx, request, "reminder-status", parseReminderStatus, (b) =>
      ctx.runMutation(internal.automation.recordReminder, b),
    ),
  ),
});

http.route({
  path: "/n8n/notification-status",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handlePost(ctx, request, "notification-status", parseNotificationStatus, (b) =>
      ctx.runMutation(internal.automation.recordNotification, b),
    ),
  ),
});

http.route({
  path: "/n8n/automation-failure",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handlePost(ctx, request, "automation-failure", parseAutomationFailure, (b) =>
      ctx.runMutation(internal.automation.recordFailure, {
        idempotencyKey: b.idempotencyKey,
        workflow: b.workflow,
        loanId: b.loanId,
        message: b.message,
      }),
    ),
  ),
});

export default http;
