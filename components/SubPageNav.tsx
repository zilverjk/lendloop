"use client";

import { usePathname } from "next/navigation";
import { backTargetFor, breadcrumbsFor } from "@/lib/nav";
import { BackLink } from "./BackLink";
import { Breadcrumbs } from "./Breadcrumbs";

/** Back link + breadcrumbs for nested pages, derived from the current path. */
export function SubPageNav() {
  const pathname = usePathname();
  const back = backTargetFor(pathname);
  const crumbs = breadcrumbsFor(pathname);
  if (!back && crumbs.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col items-start gap-3">
      {back && <BackLink href={back.href} label={back.label} />}
      <Breadcrumbs items={crumbs} />
    </div>
  );
}
