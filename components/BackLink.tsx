import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "./ui";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonClass({ variant: "secondary", size: "sm" })}>
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  );
}
