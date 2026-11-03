import type { ReactNode } from "react";
import { UserGate } from "@/components/UserGate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 focus:outline-none sm:py-10">
      <UserGate>{children}</UserGate>
    </main>
  );
}
