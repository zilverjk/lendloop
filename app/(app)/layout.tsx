import type { ReactNode } from "react";
import { UserGate } from "@/components/UserGate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <UserGate>{children}</UserGate>
    </main>
  );
}
