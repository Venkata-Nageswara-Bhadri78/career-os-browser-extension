export const MAX_URL_LENGTH = 2000;

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "chrome:",
  "chrome-extension:",
  "about:",
  "blob:",
  "view-source:",
]);

export function validateJobUrl(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, message: "Job URL cannot be blank." };
  }
  const url = raw.trim();
  if (url.length > MAX_URL_LENGTH) {
    return { ok: false, message: "Job URL cannot exceed 2000 characters." };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: "Job URL must be a valid absolute http or https link." };
  }
  const protocol = String(parsed.protocol || "").toLowerCase();
  if (BLOCKED_PROTOCOLS.has(protocol) || (protocol !== "http:" && protocol !== "https:")) {
    return { ok: false, message: "Job URL must be a valid absolute http or https link." };
  }
  if (!parsed.hostname) {
    return { ok: false, message: "Job URL must be a valid absolute http or https link." };
  }
  return { ok: true, url };
}
