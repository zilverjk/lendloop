/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

export const modules = import.meta.glob("../convex/**/*.*s");

export function makeT() {
  return convexTest(schema, modules);
}
export type T = ReturnType<typeof makeT>;

export function identity(key: string) {
  return {
    subject: key,
    tokenIdentifier: `https://issuer.test|${key}`,
    name: `${key} Person`,
    email: `${key}@example.com`,
  };
}

export async function signIn(t: T, key: string) {
  const as = t.withIdentity(identity(key));
  const id = await as.mutation(api.users.store, {});
  return { as, id };
}

export async function makeAdmin(t: T, key: string) {
  const u = await signIn(t, key);
  await t.mutation(internal.admin.setRole, { email: `${key}@example.com`, role: "admin" });
  return u;
}

export function dayOffset(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export const newTool = {
  name: "Cordless drill",
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V, two batteries",
};
