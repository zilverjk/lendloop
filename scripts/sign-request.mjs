// Shared HMAC helpers matching convex/lib/hmac.ts: header "t=<unix>,v1=hex(HMAC-SHA256(secret, `${t}.${body}`))".
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function sign(secret, body, nowSec = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${nowSec}.${body}`).digest("hex");
  return `t=${nowSec},v1=${v1}`;
}

/** Reads n8n/.env (KEY=VALUE lines) without printing anything. */
export function loadN8nEnv() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "n8n", ".env");
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

// CLI: node scripts/sign-request.mjs <secret-env-var> <body>   -> prints the signature header
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, body = ""] = process.argv.slice(2);
  const secret = process.env[name] ?? loadN8nEnv()[name];
  if (!secret) {
    console.error("usage: node scripts/sign-request.mjs LENDLOOP_WEBHOOK_SECRET '<json body>'");
    process.exit(1);
  }
  console.log(sign(secret, body));
}
