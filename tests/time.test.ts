import { describe, expect, it } from "vitest";
import { activityLabel, relativeTime } from "../lib/time";

const NOW = 1_700_000_000_000;

describe("relativeTime", () => {
  it("handles just now and future", () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe("just now");
    expect(relativeTime(NOW + 5_000_000, NOW)).toBe("just now");
  });
  it("formats minutes, hours, days with pluralization", () => {
    expect(relativeTime(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });
});

describe("activityLabel", () => {
  it("labels each kind", () => {
    expect(activityLabel("reminder_sent", NOW - 2 * 86_400_000, NOW)).toBe("Reminder sent 2 days ago");
    expect(activityLabel("notification_sent", NOW - 5 * 60_000, NOW)).toBe("Notification sent 5 minutes ago");
    expect(activityLabel("automation_failed", NOW - 1000, NOW)).toBe("Automation failed just now");
  });
});
