"use client";

import { activityLabel, type ActivityKind } from "@/lib/time";

export function ActivityList({ activity }: { activity: { kind: ActivityKind; createdAt: number }[] }) {
  if (activity.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {activity.map((a, i) => (
        <li key={i} className={a.kind === "automation_failed" ? "text-red-700" : "text-zinc-500"}>
          {activityLabel(a.kind, a.createdAt)}
        </li>
      ))}
    </ul>
  );
}
