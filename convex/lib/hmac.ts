/**
 * HMAC-SHA256 request signing using Web Crypto only (works in the Convex
 * default runtime, Node 22 and Vitest's edge-runtime).
 *
 * Header format: `t=<unix seconds>,v1=<hex>` where
 * hex = HMAC-SHA256(secret, `${t}.${body}`).
 */

export const SIGNATURE_HEADER = "X-LendLoop-Signature";
export const EVENT_ID_HEADER = "X-LendLoop-Event-Id";
export const DEFAULT_TOLERANCE_SEC = 300;

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing" | "malformed" | "expired" | "future" | "mismatch";
    };

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Constant-time string comparison (length is not secret: hex digests). */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function signPayload(
  secret: string,
  body: string,
  nowSec: number,
): Promise<string> {
  const t = Math.floor(nowSec);
  const sig = await hmacHex(secret, `${t}.${body}`);
  return `t=${t},v1=${sig}`;
}

export function parseSignatureHeader(
  header: string | null | undefined,
): { t: number; v1: string } | null {
  if (!header) return null;
  const parts = header.split(",");
  if (parts.length !== 2) return null;
  const [tPart, vPart] = parts.map((p) => p.trim());
  const tMatch = /^t=(\d{1,12})$/.exec(tPart);
  const vMatch = /^v1=([0-9a-f]{64})$/.exec(vPart);
  if (!tMatch || !vMatch) return null;
  return { t: Number(tMatch[1]), v1: vMatch[1] };
}

export async function verifySignature(
  secret: string,
  body: string,
  header: string | null | undefined,
  nowSec: number,
  toleranceSec: number = DEFAULT_TOLERANCE_SEC,
): Promise<VerifyResult> {
  if (header === null || header === undefined || header === "") {
    return { ok: false, reason: "missing" };
  }
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "malformed" };
  if (parsed.t < nowSec - toleranceSec) return { ok: false, reason: "expired" };
  if (parsed.t > nowSec + toleranceSec) return { ok: false, reason: "future" };
  const expected = await hmacHex(secret, `${parsed.t}.${body}`);
  if (!timingSafeEqual(expected, parsed.v1)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}
