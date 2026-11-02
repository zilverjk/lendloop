#!/bin/sh
# 1. Create/refresh the HMAC credentials from env (fixed ids => idempotent; encrypted with
#    N8N_ENCRYPTION_KEY; the plaintext temp file is removed immediately).
# 2. Import the version-controlled workflows (fixed ids are overwritten) and publish them.
#    Import deactivates workflows, so publish must run after it. Error handler first so
#    errorWorkflow refs resolve.
# Secrets are read from env only here, never by Code nodes (N8N_BLOCK_ENV_ACCESS_IN_NODE=true).
set -e
: "${LENDLOOP_WEBHOOK_SECRET:?LENDLOOP_WEBHOOK_SECRET missing}"
: "${N8N_INBOUND_SECRET:?N8N_INBOUND_SECRET missing}"
: "${CONVEX_SITE_URL:?CONVEX_SITE_URL missing}"

CRED_FILE="$(mktemp /tmp/ll-creds.XXXXXX)"
trap 'rm -f "$CRED_FILE"' EXIT
node -e '
const e = process.env;
const c = (id, name, secret, baseUrl) => ({ id, name, type: "lendLoopHmacApi", data: { secret, baseUrl } });
process.stdout.write(JSON.stringify([
  c("llCredWebhook01", "LendLoop webhook secret (Convex to n8n)", e.LENDLOOP_WEBHOOK_SECRET, ""),
  c("llCredInbound01", "LendLoop inbound secret (n8n to Convex)", e.N8N_INBOUND_SECRET, e.CONVEX_SITE_URL),
]));
' > "$CRED_FILE"
echo "Importing LendLoop credentials"
n8n import:credentials --input="$CRED_FILE"
rm -f "$CRED_FILE"

echo "Importing LendLoop workflows from /workflows"
n8n import:workflow --separate --input=/workflows
for id in llErrorHandler01 llRequestNotify1 llOverdueRemind1; do
  n8n publish:workflow --id="$id"
done
exec n8n start
