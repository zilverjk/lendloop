"use client";

import { activityLabel, type ActivityKind } from "@/lib/time";

export function ActivityList({ activity }: { activity: { kind: ActivityKind; createdAt: number }[] }) {
  if (activity.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs" aria-label="Activity">
      {activity.map((a, i) => (
        <li key={i} className={a.kind === "automation_failed" ? "font-medium text-danger-700" : "text-muted"}>
          {activityLabel(a.kind, a.createdAt)}
        </li>
      ))}
    </ul>
  );
}
