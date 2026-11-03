import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "List a tool" };

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
}
