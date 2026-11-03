import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Browse tools" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
