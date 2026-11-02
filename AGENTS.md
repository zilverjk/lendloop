# AGENTS.md — LendLoop

Guidance for coding agents working in this repo. Read it before changing code.

## Project overview

LendLoop is a neighborhood tool-lending board. Neighbors list tools, request to borrow them for a date range, and get notifications and overdue reminders handled by n8n.

- **Next.js (App Router)** + TypeScript + Tailwind: UI only. Next.js 16 has breaking changes vs. older versions; check `node_modules/next/dist/docs/` when unsure (middleware lives in `proxy.ts`).
- **Clerk**: authentication. Convex validates the Clerk JWT (`convex/auth.config.ts`).
- **Convex**: data, business logic, authorization, and the signed HTTP endpoints used by n8n.
- **n8n** (self-hosted, `n8n/docker-compose.yml`): request notifications, daily overdue reminders, error workflow.

## Folder map

| Path | Contents |
|---|---|
| `app/` | Routes: `/` public board, `(app)/` signed-in pages (tools, `me/*`, `admin`) |
| `components/`, `lib/` | UI components; client helpers (relative time, error messages, constants) |
| `proxy.ts` | Clerk route protection |
| `convex/` | Schema, queries/mutations (`tools`, `loans`, `users`, `admin`), outbox (`notifications`), n8n write-backs (`automation`), HTTP routes (`http.ts`), crons |
| `convex/lib/` | `authz.ts`, `hmac.ts`, `validation.ts`, `payload.ts`, `redact.ts`, `log.ts`, `audit.ts` |
| `n8n/` | docker-compose, entrypoint (imports credentials + workflows), env template (`example.env`), exported workflows in `n8n/workflows/`, local `LendLoop HMAC` node + `lendLoopHmacApi` credential in `n8n/custom/` |
| `scripts/` | `build-workflows.mjs` (workflow source), `sign-request.mjs`, `smoke-n8n.mjs` (end-to-end check) |
| `tests/` | Vitest + convex-test suites |

## Rules

### Authorization
- RBAC is **always** enforced inside Convex functions using `convex/lib/authz.ts` (`requireUser`, `requireAdmin`, ownership helpers and pure `can*` decisions). Hiding a button in the UI is never the guard.
- Every new public query/mutation must declare `v` arg validators and call the authz helpers before reading or writing private data.
- Roles are never settable from the client; admin bootstrap is the internal `admin:setRole` mutation run from the CLI. Admin actions write an audit row (`convex/lib/audit.ts`).
- Anything not meant for the browser is an `internalQuery` / `internalMutation` / `internalAction`.

### Webhooks and HMAC
- Webhooks are HMAC-SHA256 signed and verified in **both** directions (Convex → n8n and n8n → Convex), with a **separate secret per direction**.
- Header `X-LendLoop-Signature: t=<unix>,v1=<hex>` over `${t}.${rawBody}`; reject outside the 300 s window (past or future); compare in constant time; fail closed when a secret is missing.
- In n8n, signing/verification happens only in the `LendLoop HMAC` node (`n8n/custom/n8n-nodes-lendloop`), which reads the secret from an n8n credential; Code nodes cannot read env (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`). Keep that node and `convex/lib/hmac.ts` byte-for-byte compatible, and keep the tests in `tests/hmac.test.ts` green.

### Idempotency and failures
- Every write-back from n8n carries an idempotency key (`notify:<eventId>`, `reminder:<loanId>:<YYYY-MM-DD>`, `fail:<executionId>`). A retry must never create a second record or send a second reminder.
- Outbound delivery goes through the outbox with backoff (`convex/notifications.ts`). In n8n, HTTP calls use retries, and both main workflows set `errorWorkflow` so failed runs reach the error workflow and are recorded in Convex. Failures must never be silent.

### Data minimization and privacy
- n8n payloads and public queries expose only the fields they need. Payload builders live in `convex/lib/payload.ts`. The public board returns tool name + category only, and other users only ever see an owner's first name.
- Logs are structured (`convex/lib/log.ts`) and must not contain emails, tokens or secrets. Redact free-text error messages (`convex/lib/redact.ts`) before storing or logging them.
- Validate all input (`convex/lib/validation.ts`): lengths, enums, date ranges, body size.

### Secrets
- No secrets in code, tests, docs or exported n8n workflow JSON. Use env vars (`.env.local`, `npx convex env set`, `n8n/.env`) or n8n Credentials. Only the templates `.env.example` and `n8n/example.env` are committed, with placeholder values.

### n8n workflows
- The workflow JSON in `n8n/workflows/` is generated from `scripts/build-workflows.mjs`. After any workflow change, re-export by running `node scripts/build-workflows.mjs` and commit the regenerated JSON. Never commit a raw export from a live instance without scrubbing credentials data, execution data and personal data.
- Verify with `docker compose -f n8n/docker-compose.yml up -d --force-recreate` and `node scripts/smoke-n8n.mjs`.

## Before committing

All of these must pass:

```bash
pnpm lint
pnpm typecheck   # next typegen && tsc --noEmit
pnpm test
pnpm build
```

Add or update tests for any change to authz, HMAC, idempotency, validation or payload shape.
