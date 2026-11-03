import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { relaxCookiesForInsecureOrigin } from "@/lib/devHttpCookies";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

// Next 16 renamed `middleware` to `proxy`. Non-public routes require sign-in;
// data access is still enforced server-side in Convex functions.
const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const res = await clerk(req, event);
  // Dev only: the Clerk dev-instance handshake sets `Secure; SameSite=None`
  // cookies, which browsers reject on plain-http non-localhost origins (e.g.
  // http://zilver-server:3000), causing a handshake redirect loop and a
  // signed-out server render. Make them storable there. Never in production.
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  if (res && process.env.NODE_ENV !== "production" && proto === "http") {
    relaxCookiesForInsecureOrigin(res.headers);
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
