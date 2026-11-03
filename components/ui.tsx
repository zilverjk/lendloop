import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-line-strong bg-surface text-ink hover:border-brand-600 hover:bg-surface-muted active:bg-line",
  ghost: "text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  danger: "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-fg",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-10 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

/** Class string so `next/link` and anchors can look like buttons. */
export function buttonClass({ variant = "primary", size = "md", className = "" }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size, className })}>
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface p-5 shadow-card ${className}`}>{children}</div>;
}

type Tone = "green" | "gray" | "amber" | "red" | "brand" | "sky";
const tones: Record<Tone, string> = {
  green: "bg-success-bg text-success-fg",
  gray: "bg-surface-muted text-muted",
  amber: "bg-warning-bg text-warning-fg",
  red: "bg-danger-bg text-danger-fg",
  brand: "bg-brand-100 text-brand-800",
  sky: "bg-info-bg text-info-fg",
};

export function Badge({ tone = "gray", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** Static category/meta pill. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">{children}</span>;
}

/** Toggle chip used for filters. */
export function FilterChip({ selected, children, ...props }: { selected: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed">) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={selected}
      className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 py-1 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-surface text-ink hover:border-brand-600 hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Page structure ---------- */

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-base text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionHeading({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ---------- Feedback ---------- */

type AlertTone = "error" | "success" | "info";
const alertStyles: Record<AlertTone, { box: string; icon: ReactNode }> = {
  error: { box: "border-red-200 bg-danger-bg text-danger-fg", icon: <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> },
  success: { box: "border-green-200 bg-success-bg text-success-fg", icon: <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> },
  info: { box: "border-sky-200 bg-info-bg text-info-fg", icon: <Info aria-hidden className="mt-0.5 size-4 shrink-0" /> },
};

export function Alert({ tone = "info", children, className = "" }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  const s = alertStyles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${s.box} ${className}`}>
      {s.icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Backwards-compatible error text (used by UserGate and forms). */
export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert tone="error" className="mt-2">{message}</Alert>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-muted ${className}`} />;
}

/** Accessible loading region with skeleton placeholders. */
export function Loading({ label = "Loading…", rows = 3, variant = "cards" }: { label?: string; rows?: number; variant?: "cards" | "grid" | "inline" }) {
  if (variant === "inline") {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        {label}
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className={variant === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4"}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
            <Skeleton className="size-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 [&_svg]:size-6">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Form fields ---------- */

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

export function Field({
  label,
  id,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  label: string;
  id: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 font-normal text-muted">(optional)</span>
        )}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": required ? true : undefined })}
      {hint && (
        <div id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger-700">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted shadow-sm disabled:cursor-not-allowed disabled:bg-surface-muted aria-[invalid=true]:border-danger-600";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} min-h-10 ${props.className ?? ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} min-h-10 ${props.className ?? ""}`} />;
}
