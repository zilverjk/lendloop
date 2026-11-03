"use client";

import { useMutation, useQuery } from "convex/react";
import { Lock, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SubPageNav } from "@/components/SubPageNav";
import { ToolForm } from "@/components/ToolForm";
import { buttonClass, EmptyState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function EditToolPage() {
  const { id } = useParams<{ id: string }>();
  const toolId = id as Id<"tools">;
  const tool = useQuery(api.tools.get, { toolId });
  const update = useMutation(api.tools.update);
  const router = useRouter();

  const back = (
    <Link href="/me/listings" className={buttonClass({ variant: "secondary" })}>
      Back to my listings
    </Link>
  );

  if (tool === undefined) return <Loading label="Loading listing…" rows={1} />;
  if (tool === null) return <EmptyState icon={<SearchX aria-hidden />} title="Tool not found" action={back}>This listing may have been removed.</EmptyState>;
  if (!tool.isOwner) {
    return (
      <EmptyState icon={<Lock aria-hidden />} title="Not authorized" action={back}>
        Only the owner can edit this listing.
      </EmptyState>
    );
  }

  return (
    <>
      <SubPageNav />
      <PageHeader title="Edit listing" description="Update the details borrowers see." />
      <ToolForm
        submitLabel="Save changes"
        initial={{ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description }}
        onSubmit={async (v) => {
          await update({ toolId, ...v });
          router.push("/me/listings");
        }}
      />
    </>
  );
}
