#!/usr/bin/env node
// Idempotently creates/updates the Clerk JWT template named `convex`.
// Reads CLERK_SECRET_KEY from the environment or .env.local. Never prints secrets.
import { readFileSync } from "node:fs";

export const TEMPLATE_NAME = "convex";
export const CLAIMS = {
  aud: "convex",
  name: "{{user.full_name}}",
  given_name: "{{user.first_name}}",
  family_name: "{{user.last_name}}",
  email: "{{user.primary_email_address}}",
  email_verified: "{{user.email_verified}}",
  nickname: "{{user.username}}",
  picture_url: "{{user.image_url}}",
};

function loadKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  try {
    const m = readFileSync(".env.local", "utf8").match(/^CLERK_SECRET_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return undefined;
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error("CLERK_SECRET_KEY not found in env or .env.local");
    process.exit(1);
  }
  const api = async (method, path, body) => {
    const res = await fetch(`https://api.clerk.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Clerk API ${method} ${path} failed: ${res.status}`);
    return res.json();
  };
  const list = await api("GET", "/jwt_templates");
  const items = Array.isArray(list) ? list : (list.data ?? []);
  const existing = items.find((t) => t.name === TEMPLATE_NAME);
  const body = { name: TEMPLATE_NAME, claims: CLAIMS };
  const saved = existing
    ? await api("PATCH", `/jwt_templates/${existing.id}`, body)
    : await api("POST", "/jwt_templates", body);
  console.log(`${existing ? "updated" : "created"} JWT template "${TEMPLATE_NAME}" (${saved.id})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
