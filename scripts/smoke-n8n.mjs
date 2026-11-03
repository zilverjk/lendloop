// End-to-end smoke test for the n8n automation. Requires: local Convex dev deployment running
// (CONVEX_AGENT_MODE=anonymous npx convex dev), Convex env ALLOW_DEV_SEED=true plus the matching
// secrets/N8N_WEBHOOK_URL, and `docker compose up -d` in n8n/. Run: node scripts/smoke-n8n.mjs
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadN8nEnv, sign } from "./sign-request.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadN8nEnv();
const WEBHOOK = process.env.N8N_WEBHOOK_URL ?? "http://localhost:5678/webhook/lendloop/request-notification";
const results = [];

function check(name, ok, evidence) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${evidence ? `  [${evidence}]` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function convexRun(fn, args = {}) {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: root,
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
    encoding: "utf8",
  });
  const start = out.search(/[{[]/);
  return JSON.parse(out.slice(start));
}
const activity = (loanId) => convexRun("devSeed:loanActivity", { loanId });
const count = (a, kind) => a.events.filter((e) => e.kind === kind).length;

async function waitFor(fn, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(1000);
  }
}

async function post(body, signature, extra = {}) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(signature ? { "X-LendLoop-Signature": signature } : {}), ...extra },
    body,
  });
  return { status: res.status, text: await res.text() };
}

function payload(eventId, loanId) {
  return JSON.stringify({
    eventId,
    type: "loan.requested",
    occurredAt: new Date().toISOString(),
    loan: { id: loanId, status: "pending", startDate: "2030-01-01", endDate: "2030-01-03" },
    tool: { name: "Smoke drill" },
    recipient: { email: "smoke.recipient@example.com", firstName: "Sam" },
    counterparty: { firstName: "Alex" },
  });
}

const seededToolIds = [];
const seed = (args) => {
  const r = convexRun("devSeed:seedLoan", args);
  if (r.toolId) seededToolIds.push(r.toolId);
  return r;
};
let cleaned = false;
function cleanupSeeded() {
  if (cleaned || seededToolIds.length === 0) return;
  cleaned = true;
  try {
    const r = convexRun("devSeed:cleanup", { toolIds: seededToolIds });
    console.log(`cleanup: removed ${r.tools} tool(s), ${r.loans} loan(s), ${r.outboundEvents} outbound, ${r.automationEvents} automation, ${r.auditLogs} audit row(s)`);
  } catch (e) {
    console.error(`cleanup failed: ${e.message}`);
  }
}
process.on("SIGINT", () => {
  cleanupSeeded();
  process.exit(130);
});

try {
// 1. Convex -> n8n -> Convex round trip
const pending = seed({ scenario: "pending" });
const a1 = await waitFor(() => {
  const a = activity(pending.loanId);
  return count(a, "notification_sent") === 1 ? a : null;
});
check("outbound webhook delivered and notification-status write-back recorded", !!a1 && a1.outbound[0]?.acknowledged, a1 ? `events=${a1.events.length}, outbound=${a1.outbound[0].status}` : "timeout");

// 2. Signature verification
const body = payload(randomUUID(), pending.loanId);
let r = await post(body, undefined);
check("unsigned request rejected", r.status === 401, `HTTP ${r.status}`);
r = await post(body, sign(env.LENDLOOP_WEBHOOK_SECRET, body).replace(/.$/, (c) => (c === "0" ? "1" : "0")));
check("tampered signature rejected", r.status === 401, `HTTP ${r.status}`);
r = await post(body + " ", sign(env.LENDLOOP_WEBHOOK_SECRET, body));
check("tampered body rejected", r.status === 401, `HTTP ${r.status}`);
r = await post(body, sign(env.LENDLOOP_WEBHOOK_SECRET, body, Math.floor(Date.now() / 1000) - 600));
check("expired timestamp (600s old) rejected", r.status === 401, `HTTP ${r.status}`);
r = await post(body, sign(env.N8N_INBOUND_SECRET, body));
check("wrong-direction secret rejected", r.status === 401, `HTTP ${r.status}`);

// 3. Replay of an already processed event id (same eventId, fresh valid signature)
const replayBody = payload(pending.eventId, pending.loanId);
r = await post(replayBody, sign(env.LENDLOOP_WEBHOOK_SECRET, replayBody));
check("replayed eventId deduplicated", r.status === 200 && r.text.includes('"duplicate":true'), `HTTP ${r.status} ${r.text}`);
await sleep(2000);
check("no extra automationEvent after replay", count(activity(pending.loanId), "notification_sent") === 1);

// 4. Overdue reminders, run twice
const overdue = seed({ scenario: "overdue", daysOverdue: 3 });
const runOverdue = () =>
  execFileSync("docker", ["compose", "exec", "-T", "-e", "N8N_RUNNERS_BROKER_PORT=5680", "n8n", "n8n", "execute", "--id", "llOverdueRemind1"], {
    cwd: join(root, "n8n"),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
const run1Out = runOverdue();
await sleep(1500);
let a2 = activity(overdue.loanId);
check("overdue run #1 created one reminder_sent", count(a2, "reminder_sent") === 1, a2.events.map((e) => e.key).join(","));
const run2Out = runOverdue();
await sleep(1500);
a2 = activity(overdue.loanId);
check("overdue run #2 is idempotent (still one reminder_sent)", count(a2, "reminder_sent") === 1);
// Same-day dedupe: the already-reminded loan must no longer be listed, and run #2 must not log a reminder for it.
const siteUrl = (process.env.CONVEX_SITE_URL_LOCAL ?? "http://127.0.0.1:3211");
const listRes = await fetch(`${siteUrl}/n8n/overdue-loans`, { headers: { "X-LendLoop-Signature": sign(env.N8N_INBOUND_SECRET, "") } });
const listed = listRes.ok ? (await listRes.json()).loans : null;
check("overdue endpoint excludes loans already reminded today", !!listed && !listed.some((l) => l.loanId === overdue.loanId), `HTTP ${listRes.status}`);
const reminded = (out) => out.split("\n").filter((l) => l.includes("mock_reminder") && l.includes(overdue.loanId)).length;
check("second same-day run sent no new reminder", reminded(run1Out) === 1 && reminded(run2Out) === 0, `run1 mock_reminder=${reminded(run1Out)}, run2=${reminded(run2Out)}`);

// 5. Failure path: valid signature but unknown loan -> Convex 404 -> retries exhausted -> error workflow
const before = convexRun("devSeed:recentFailures").length;
const failBody = payload(randomUUID(), "doesnotexist0000000000000000000000");
r = await post(failBody, sign(env.LENDLOOP_WEBHOOK_SECRET, failBody));
check("failing event is still accepted by webhook", r.status === 200, `HTTP ${r.status}`);
const fails = await waitFor(() => {
  const f = convexRun("devSeed:recentFailures");
  return f.length > before ? f : null;
}, 40000);
check("error handler recorded an automation_failed event", !!fails, fails ? `${fails[0].key} :: ${fails[0].detail}` : "timeout");

} finally {
  cleanupSeeded();
}

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
