#!/bin/sh
# Import the version-controlled workflows (idempotent: fixed ids are overwritten),
# publish (activate) them, then start n8n. Import deactivates workflows, so the
# publish step must run after it. Error handler first so errorWorkflow refs resolve.
set -e
echo "Importing LendLoop workflows from /workflows"
n8n import:workflow --separate --input=/workflows
for id in llErrorHandler01 llRequestNotify1 llOverdueRemind1; do
  n8n publish:workflow --id="$id"
done
exec n8n start
