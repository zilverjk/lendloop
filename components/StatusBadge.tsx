import { Badge } from "./ui";

const tone = { pending: "amber", approved: "green", declined: "red", returned: "gray", cancelled: "gray" } as const;

export function StatusBadge({ status }: { status: keyof typeof tone }) {
  return <Badge tone={tone[status]}>{status}</Badge>;
}
