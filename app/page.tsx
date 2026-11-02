import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { PublicTools } from "@/components/PublicTools";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-semibold tracking-tight">LendLoop</h1>
      <p className="mt-2 text-lg text-zinc-600">Borrow what you need. Lend what you don&apos;t.</p>
      <div className="mt-6">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Sign in to lend or borrow
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/tools"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Browse or lend tools
          </Link>
        </Show>
      </div>
      <section aria-labelledby="available" className="mt-10">
        <h2 id="available" className="mb-3 text-xl font-semibold">
          Available now
        </h2>
        <PublicTools />
      </section>
    </main>
  );
}
