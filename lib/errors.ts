import { ConvexError } from "convex/values";

type ErrData = { code?: string; message?: string; field?: string };

const FIELD_NAMES: Record<string, string> = {
  name: "Name",
  description: "Description",
  startDate: "Start date",
  endDate: "End date",
};

/** Turn any thrown error (ideally a ConvexError) into a friendly sentence. */
export function friendlyError(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = (typeof err.data === "object" && err.data !== null ? err.data : {}) as ErrData;
    switch (data.code) {
      case "INVALID_INPUT": {
        const field = data.field ? (FIELD_NAMES[data.field] ?? data.field) : "Input";
        return `${field}: ${data.message ?? "invalid value"}`;
      }
      case "UNAUTHENTICATED":
        return "Please sign in to continue.";
      case "USER_NOT_FOUND":
        return "Your account is still being set up. Try again in a moment.";
      case "FORBIDDEN":
        return data.message ?? "You are not allowed to do that.";
      case "NOT_FOUND":
        return data.message ?? "That item no longer exists.";
      case "CONFLICT":
        return data.message ?? "That action conflicts with the current state.";
      case "DUPLICATE_REQUEST":
        return "You already have a pending request for this tool. Wait for the owner to respond or cancel it first.";
      case "RATE_LIMITED":
        return "You have too many pending requests. Wait for some to be answered or cancel one.";
      default:
        return data.message ?? "Something went wrong.";
    }
  }
  return "Something went wrong. Please try again.";
}
