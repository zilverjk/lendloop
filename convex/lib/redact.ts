/** Strip email addresses and long token-like strings (hex, base64url, ids) from free text. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_TOKEN = /[A-Za-z0-9_-]{24,}/g;

export function redactMessage(text: string): string {
  return text.replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]");
}
