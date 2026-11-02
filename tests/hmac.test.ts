import { describe, expect, it } from "vitest";
import { parseSignatureHeader, signPayload, verifySignature } from "../convex/lib/hmac";

const secret = "s3cret";
const body = JSON.stringify({ a: 1 });
const now = 1_700_000_000;

describe("hmac", () => {
  it("accepts a valid signature", async () => {
    const h = await signPayload(secret, body, now);
    expect(h).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(await verifySignature(secret, body, h, now + 10)).toEqual({ ok: true });
  });

  it("accepts empty body (GET)", async () => {
    const h = await signPayload(secret, "", now);
    expect(await verifySignature(secret, "", h, now)).toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const h = await signPayload(secret, body, now);
    expect(await verifySignature(secret, body + " ", h, now)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a tampered timestamp", async () => {
    const h = await signPayload(secret, body, now);
    const forged = h.replace(`t=${now}`, `t=${now + 1}`);
    expect(await verifySignature(secret, body, forged, now)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects the wrong secret", async () => {
    const h = await signPayload("other", body, now);
    expect(await verifySignature(secret, body, h, now)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects expired timestamps", async () => {
    const h = await signPayload(secret, body, now);
    expect(await verifySignature(secret, body, h, now + 301)).toEqual({ ok: false, reason: "expired" });
    expect((await verifySignature(secret, body, h, now + 300)).ok).toBe(true);
  });

  it("rejects future timestamps", async () => {
    const h = await signPayload(secret, body, now + 301);
    expect(await verifySignature(secret, body, h, now)).toEqual({ ok: false, reason: "future" });
  });

  it("rejects missing and malformed headers", async () => {
    expect(await verifySignature(secret, body, null, now)).toEqual({ ok: false, reason: "missing" });
    expect(await verifySignature(secret, body, "", now)).toEqual({ ok: false, reason: "missing" });
    for (const bad of ["garbage", `t=${now}`, `v1=abc`, `t=abc,v1=${"a".repeat(64)}`, `t=${now},v1=zz`, `t=${now},v1=${"a".repeat(64)},x=1`]) {
      expect(await verifySignature(secret, body, bad, now)).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("parses headers", () => {
    expect(parseSignatureHeader(`t=5,v1=${"b".repeat(64)}`)).toEqual({ t: 5, v1: "b".repeat(64) });
    expect(parseSignatureHeader(undefined)).toBeNull();
  });
});
