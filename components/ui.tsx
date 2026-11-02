import type { ButtonHTMLAttributes, ReactNode } from "react";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export const inputClass = `w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 ${focus} disabled:opacity-50`;

type Variant = "primary" | "secondary" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${variants[variant]} ${className}`}
    />
  );
}

type Tone = "green" | "gray" | "amber" | "red" | "indigo";
const tones: Record<Tone, string> = {
  green: "bg-green-100 text-green-800",
  gray: "bg-zinc-100 text-zinc-700",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
  indigo: "bg-indigo-100 text-indigo-800",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-zinc-900">{children}</h1>
      {action}
    </div>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="text-sm text-zinc-500">
      {label}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
