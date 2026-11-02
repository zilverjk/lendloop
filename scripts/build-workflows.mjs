// Generates n8n/workflows/*.json from readable Code-node sources.
// Run: node scripts/build-workflows.mjs   (output is committed; contains no secrets)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "n8n", "workflows");
const IDS = {
  notify: "llRequestNotify1",
  overdue: "llOverdueRemind1",
  error: "llErrorHandler01",
};

const SIGN_FN = `const crypto = require('crypto');
function sign(secret, body) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(t + '.' + body).digest('hex');
  return 't=' + t + ',v1=' + v1;
}
function maskEmail(e) {
  const [l, d] = String(e || '').split('@');
  return l && d ? l[0] + '***@' + d : '***';
}
function logEvent(level, event, fields) {
  // Reaches docker logs because CODE_ENABLE_STDOUT=true (set in docker-compose.yml).
  console.log(JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields }));
}`;

const retry = { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 };

const code = (name, jsCode, position, extra = {}, perItem = false) => ({
  parameters: perItem ? { mode: "runOnceForEachItem", jsCode } : { jsCode },
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position,
  ...extra,
});

const http = (name, method, path, position) => ({
  parameters: {
    method,
    url: `={{ $env.CONVEX_SITE_URL + '${path}' }}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [{ name: "X-LendLoop-Signature", value: "={{ $json.signature }}" }],
    },
    ...(method === "POST"
      ? {
          sendBody: true,
          contentType: "raw",
          rawContentType: "application/json",
          body: "={{ $json.body }}",
        }
      : {}),
    options: { timeout: 10000 },
  },
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position,
  ...retry,
});

const workflow = (id, name, nodes, connections, settings = {}) => ({
  id,
  name,
  active: true,
  nodes,
  connections,
  settings: { executionOrder: "v1", ...settings },
  pinData: {},
  tags: [],
});
const link = (...names) => {
  const c = {};
  names.slice(0, -1).forEach((n, i) => {
    c[n] = { main: [[{ node: names[i + 1], type: "main", index: 0 }]] };
  });
  return c;
};

// ---------------------------------------------------------------- 1. notification
const verify = `${SIGN_FN}
const TOLERANCE_SEC = 300;
const item = $input.first();
const headers = item.json.headers || {};
const staticData = $getWorkflowStaticData('global');

function reject(reason, httpCode = 401) {
  logEvent('warn', 'webhook.rejected', { reason });
  return [{ json: { status: 'invalid', httpCode, reason } }];
}

const secret = $env.LENDLOOP_WEBHOOK_SECRET;
if (!secret) return reject('not_configured', 500);

// Raw body bytes exactly as sent (Webhook node option "Raw Body").
let raw = '';
try {
  raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
} catch (e) {
  return reject('no_raw_body');
}

const header = String(headers['x-lendloop-signature'] || '');
if (!header) return reject('missing_signature');
const m = /^t=(\\d{1,12}),v1=([0-9a-f]{64})$/.exec(header.trim());
if (!m) return reject('malformed_signature');
const t = Number(m[1]);
const now = Math.floor(Date.now() / 1000);
if (Math.abs(now - t) > TOLERANCE_SEC) return reject('timestamp_out_of_window');

const expected = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest();
const given = Buffer.from(m[2], 'hex');
if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) {
  return reject('signature_mismatch');
}

let p;
try { p = JSON.parse(raw); } catch (e) { return reject('invalid_json', 400); }
const idOk = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);
if (!p || !idOk(p.eventId) || !p.loan || !idOk(p.loan.id) || !p.recipient || typeof p.type !== 'string') {
  return reject('invalid_payload', 400);
}

// Replay / duplicate protection: remember the last 500 event ids.
const seen = staticData.seenEventIds || [];
if (seen.includes(p.eventId)) {
  logEvent('info', 'webhook.duplicate', { eventId: p.eventId });
  return [{ json: { status: 'duplicate', httpCode: 200, reason: 'duplicate' } }];
}
seen.push(p.eventId);
staticData.seenEventIds = seen.slice(-500);

return [{ json: { status: 'ok', httpCode: 200, payload: p } }];`;

const mock = `${SIGN_FN}
const p = $json.payload;
const subjects = {
  'loan.requested': (p.counterparty.firstName || 'Someone') + ' wants to borrow your ' + p.tool.name,
  'loan.approved': 'Your request for ' + p.tool.name + ' was approved',
  'loan.declined': 'Your request for ' + p.tool.name + ' was declined',
  'loan.returned': p.tool.name + ' was marked as returned',
  'loan.cancelled': (p.counterparty.firstName || 'Someone') + ' cancelled the request for ' + p.tool.name,
};
// Logged mock notifier: nothing is actually sent. Recipient address is masked.
logEvent('info', 'mock_notification', {
  channel: 'mock-log',
  type: p.type,
  eventId: p.eventId,
  loanId: p.loan.id,
  to: maskEmail(p.recipient.email),
  firstName: p.recipient.firstName,
  subject: subjects[p.type] || p.type,
  dates: p.loan.startDate + ' -> ' + p.loan.endDate,
});
return [{ json: { eventId: p.eventId, loanId: p.loan.id, channel: 'mock-log', status: 'sent' } }];`;

const signNotify = `${SIGN_FN}
const secret = $env.N8N_INBOUND_SECRET;
if (!secret) throw new Error('N8N_INBOUND_SECRET not configured');
const j = $json;
const body = JSON.stringify({
  idempotencyKey: 'notify:' + j.eventId,
  eventId: j.eventId,
  loanId: j.loanId,
  status: j.status,
  channel: j.channel,
});
return [{ json: { body, signature: sign(secret, body) } }];`;

const notify = workflow(
  IDS.notify,
  "LendLoop – Request notification",
  [
    {
      parameters: {
        httpMethod: "POST",
        path: "lendloop/request-notification",
        responseMode: "responseNode",
        options: { rawBody: true },
      },
      id: "webhook",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 200],
      webhookId: "6b1b7a52-2f4c-4d57-9d0e-1a1f5c1e0a01",
    },
    code("Verify signature", verify, [220, 200]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
          conditions: [
            {
              id: "is-ok",
              leftValue: "={{ $json.status }}",
              rightValue: "ok",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "valid-signature",
      name: "Accepted?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [440, 200],
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: '={{ { ok: true } }}',
        options: { responseCode: 200 },
      },
      id: "respond-ok",
      name: "Respond 200",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [660, 100],
    },
    {
      parameters: {
        respondWith: "json",
        responseBody:
          "={{ $json.status === 'duplicate' ? { ok: true, duplicate: true } : { error: 'unauthorized' } }}",
        options: { responseCode: "={{ $json.httpCode }}" },
      },
      id: "respond-reject",
      name: "Respond 401 / duplicate",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [660, 320],
    },
    code("Mock notifier", mock, [880, 100]),
    code("Sign status", signNotify, [1100, 100]),
    http("Report notification status", "POST", "/n8n/notification-status", [1320, 100]),
  ],
  {
    Webhook: { main: [[{ node: "Verify signature", type: "main", index: 0 }]] },
    "Verify signature": { main: [[{ node: "Accepted?", type: "main", index: 0 }]] },
    "Accepted?": {
      main: [
        [{ node: "Respond 200", type: "main", index: 0 }],
        [{ node: "Respond 401 / duplicate", type: "main", index: 0 }],
      ],
    },
    "Respond 200": { main: [[{ node: "Mock notifier", type: "main", index: 0 }]] },
    ...link("Mock notifier", "Sign status", "Report notification status"),
  },
  { errorWorkflow: IDS.error },
);

// ---------------------------------------------------------------- 2. overdue
const signGet = `${SIGN_FN}
const secret = $env.N8N_INBOUND_SECRET;
if (!secret) throw new Error('N8N_INBOUND_SECRET not configured');
// GET has an empty body: message is "<t>."
return [{ json: { signature: sign(secret, '') } }];`;

const splitLoans = `${SIGN_FN}
const loans = ($json.loans || []);
logEvent('info', 'overdue.fetched', { count: loans.length });
return loans.map((l) => ({ json: l }));`;

const mockReminder = `${SIGN_FN}
const date = new Date().toISOString().slice(0, 10); // UTC day, matches Convex
const l = $json;
// Logged mock reminder: nothing is actually sent. Recipient address is masked.
logEvent('info', 'mock_reminder', {
  channel: 'mock-log',
  loanId: l.loanId,
  to: maskEmail(l.borrower && l.borrower.email),
  firstName: l.borrower && l.borrower.firstName,
  subject: 'Reminder: please return ' + (l.tool && l.tool.name) + ' (' + l.daysOverdue + ' day(s) overdue)',
});
return { json: { loanId: l.loanId, date, channel: 'mock-log', status: 'sent' } };`;

const signReminder = `${SIGN_FN}
const secret = $env.N8N_INBOUND_SECRET;
if (!secret) throw new Error('N8N_INBOUND_SECRET not configured');
const j = $json;
const body = JSON.stringify({
  idempotencyKey: 'reminder:' + j.loanId + ':' + j.date,
  loanId: j.loanId,
  status: j.status,
  channel: j.channel,
});
return { json: { body, signature: sign(secret, body) } };`;

const overdue = workflow(
  IDS.overdue,
  "LendLoop – Overdue reminders",
  [
    {
      parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 9 * * *" }] } },
      id: "schedule",
      name: "Daily 09:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 200],
    },
    {
      parameters: {},
      id: "manual",
      name: "Manual run",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 380],
    },
    code("Sign fetch", signGet, [220, 200]),
    http("Fetch overdue loans", "GET", "/n8n/overdue-loans", [440, 200]),
    code("Split loans", splitLoans, [660, 200]),
    code("Mock reminder", mockReminder, [880, 200], {}, true),
    code("Sign reminder status", signReminder, [1100, 200], {}, true),
    http("Report reminder status", "POST", "/n8n/reminder-status", [1320, 200]),
  ],
  {
    "Daily 09:00": { main: [[{ node: "Sign fetch", type: "main", index: 0 }]] },
    "Manual run": { main: [[{ node: "Sign fetch", type: "main", index: 0 }]] },
    ...link(
      "Sign fetch",
      "Fetch overdue loans",
      "Split loans",
      "Mock reminder",
      "Sign reminder status",
      "Report reminder status",
    ),
  },
  { errorWorkflow: IDS.error },
);

// ---------------------------------------------------------------- 3. error handler
const errLog = `${SIGN_FN}
const secret = $env.N8N_INBOUND_SECRET;
const e = $json;
const exec = e.execution || {};
const wf = e.workflow || {};
const message = String((exec.error && exec.error.message) || 'unknown error').slice(0, 200);
const executionId = String(exec.id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
const workflow = String(wf.name || 'unknown').slice(0, 100);
logEvent('error', 'n8n.workflow_failed', {
  workflow, workflowId: wf.id, executionId, node: exec.lastNodeExecuted, message,
});
if (!secret) throw new Error('N8N_INBOUND_SECRET not configured');
const body = JSON.stringify({
  idempotencyKey: 'fail:' + executionId,
  workflow,
  executionId,
  message: (exec.lastNodeExecuted ? exec.lastNodeExecuted + ': ' : '') + message,
});
return [{ json: { body, signature: sign(secret, body) } }];`;

const errorWf = workflow(
  IDS.error,
  "LendLoop – Error handler",
  [
    {
      parameters: {},
      id: "error-trigger",
      name: "Error Trigger",
      type: "n8n-nodes-base.errorTrigger",
      typeVersion: 1,
      position: [0, 200],
    },
    code("Log and sign failure", errLog, [220, 200]),
    http("Report failure", "POST", "/n8n/automation-failure", [440, 200]),
  ],
  link("Error Trigger", "Log and sign failure", "Report failure"),
);

const files = {
  "request-notification.json": notify,
  "overdue-reminders.json": overdue,
  "error-handler.json": errorWf,
};
for (const [f, wf] of Object.entries(files)) {
  writeFileSync(join(OUT, f), JSON.stringify(wf, null, 2) + "\n");
}
console.log("wrote", Object.keys(files).join(", "));
