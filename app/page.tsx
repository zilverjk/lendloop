import { CalendarCheck, HandHeart, ListPlus } from "lucide-react";
import { HeroCta } from "@/components/HeroCta";
import { PublicTools } from "@/components/PublicTools";

const STEPS = [
  { icon: ListPlus, title: "List what you own", text: "Add a tool in under a minute. It stays yours, and you decide who borrows it." },
  { icon: CalendarCheck, title: "Request a date range", text: "Neighbors ask to borrow for the days they need. Owners approve or decline." },
  { icon: HandHeart, title: "Return it, stay in the loop", text: "Automatic notifications and overdue reminders keep everyone on the same page." },
];

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Your neighborhood tool library</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Borrow what you need. Lend what you don&apos;t.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Skip buying a drill you will use twice. LendLoop connects neighbors who have tools sitting idle with neighbors who need them for a weekend.
          </p>
          <HeroCta />
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-5xl px-4 py-14">
        <h2 id="how" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="available" aria-labelledby="available-title" className="mx-auto max-w-5xl scroll-mt-4 px-4 pb-20">
        <h2 id="available-title" className="text-2xl font-semibold tracking-tight">
          Available now
        </h2>
        <p className="mb-6 mt-1 text-muted">A peek at what neighbors are lending right now.</p>
        <PublicTools />
      </section>
    </main>
  );
}
