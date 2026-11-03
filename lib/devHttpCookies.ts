/**
 * Clerk development instances answer the handshake with `Secure; SameSite=None`
 * cookies. Browsers silently drop those on a plain-http origin that is not
 * `localhost` (e.g. http://zilver-server:3000 over a tailnet), so the dev
 * browser / session cookies never stick, the server keeps seeing a signed-out
 * request and Clerk ends in its "infinite redirect loop" guard.
 *
 * `relaxCookiesForInsecureOrigin` rewrites those Set-Cookie headers so they are
 * storable on http. Only call it for non-production http requests.
 */
export function relaxCookiesForInsecureOrigin(headers: Headers): void {
  const cookies = headers.getSetCookie();
  if (cookies.length === 0) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const [pair, ...attrs] = cookie.split(";");
    const kept = attrs
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && a.toLowerCase() !== "secure")
      .map((a) => (a.toLowerCase() === "samesite=none" ? "SameSite=Lax" : a));
    headers.append("set-cookie", [pair, ...kept].join("; "));
  }
}
