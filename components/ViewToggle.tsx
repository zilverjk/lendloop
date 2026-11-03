import { LayoutGrid, List } from "lucide-react";
import type { BrowseView } from "@/lib/view";

const OPTIONS = [
  { value: "grid", label: "Grid view", Icon: LayoutGrid },
  { value: "list", label: "List view", Icon: List },
] as const;

/** Segmented grid/list switch. */
export function ViewToggle({ view, onChange }: { view: BrowseView; onChange: (v: BrowseView) => void }) {
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            title={label}
            onClick={() => onChange(value)}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              selected ? "bg-brand-700 text-white" : "text-ink hover:bg-brand-50"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
