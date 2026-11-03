import { describe, expect, it } from "vitest";
import { relaxCookiesForInsecureOrigin } from "../lib/devHttpCookies";

function responseWith(cookies: string[]) {
  const headers = new Headers({ location: "http://zilver-server:3000/" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 307, headers });
}

describe("relaxCookiesForInsecureOrigin", () => {
  it("drops Secure and downgrades SameSite=None to Lax", () => {
    const res = responseWith([
      "__session=abc; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Secure; SameSite=None",
      "__client_uat=1; Path=/; Secure; SameSite=None",
    ]);
    relaxCookiesForInsecureOrigin(res.headers);
    const out = res.headers.getSetCookie();
    expect(out).toHaveLength(2);
    for (const c of out) {
      expect(c).not.toMatch(/;\s*Secure/i);
      expect(c).not.toMatch(/SameSite=None/i);
      expect(c).toMatch(/SameSite=Lax/i);
    }
    expect(out[0]).toContain("__session=abc");
    expect(out[0]).toContain("Expires=Wed, 01 Jan 2031 00:00:00 GMT");
  });

  it("leaves cookies without Secure/None untouched and keeps other headers", () => {
    const res = responseWith(["__clerk_redirect_count=1; SameSite=Lax; HttpOnly; Max-Age=2"]);
    relaxCookiesForInsecureOrigin(res.headers);
    expect(res.headers.getSetCookie()).toEqual([
      "__clerk_redirect_count=1; SameSite=Lax; HttpOnly; Max-Age=2",
    ]);
    expect(res.headers.get("location")).toBe("http://zilver-server:3000/");
  });

  it("does not touch a cookie value that merely contains 'secure'", () => {
    const res = responseWith(["a=secure; Path=/; Secure; SameSite=None"]);
    relaxCookiesForInsecureOrigin(res.headers);
    expect(res.headers.getSetCookie()[0]).toMatch(/^a=secure;/);
  });
});
