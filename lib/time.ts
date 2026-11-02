const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "just now", "5 minutes ago", "2 days ago". Future timestamps clamp to "just now". */
export function relativeTime(then: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return "just now";
  for (const [unit, ms] of UNITS) {
    if (diff >= ms) {
      const n = Math.floor(diff / ms);
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

export type ActivityKind = "notification_sent" | "reminder_sent" | "automation_failed";

const LABELS: Record<ActivityKind, string> = {
  notification_sent: "Notification sent",
  reminder_sent: "Reminder sent",
  automation_failed: "Automation failed",
};

export function activityLabel(kind: ActivityKind, createdAt: number, now: number = Date.now()): string {
  const when = relativeTime(createdAt, now);
  return when === "just now" ? `${LABELS[kind]} just now` : `${LABELS[kind]} ${when}`;
}
