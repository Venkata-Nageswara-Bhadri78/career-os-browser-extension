import { MSG } from "./messages.js";

export function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

function originFromUrl(url) {
  if (!url) {
    return "";
  }
  try {
    const origin = new URL(url).origin;
    if (!origin || origin === "null" || origin.startsWith("chrome-extension:")) {
      return "";
    }
    return origin;
  } catch {
    return "";
  }
}

export function originFromSender(sender) {
  const fromTab = originFromUrl(sender?.tab?.url);
  if (fromTab) {
    return fromTab;
  }
  const fromUrl = originFromUrl(sender?.url);
  if (fromUrl) {
    return fromUrl;
  }
  if (sender?.origin && sender.origin !== "null" && !sender.origin.startsWith("chrome-extension:")) {
    return sender.origin;
  }
  return "";
}

export function coerceExpiresIn(value) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export function validateExtensionTokenMessage(message, senderOrigin, allowedOrigins) {
  if (!message || message.type !== MSG.COPILOT_EXTENSION_TOKEN) {
    return { ok: false, error: "Unknown message type." };
  }
  const origin = normalizeOrigin(senderOrigin);
  if (!origin || origin.startsWith("chrome-extension:")) {
    return { ok: false, error: "Untrusted origin." };
  }
  const allowed = (allowedOrigins || []).map(normalizeOrigin);
  if (!allowed.includes(origin)) {
    return { ok: false, error: "Untrusted origin." };
  }
  if (message.tokenType !== "Bearer") {
    return { ok: false, error: "Invalid token type." };
  }
  if (message.client !== "browser-extension") {
    return { ok: false, error: "Invalid client." };
  }
  if (typeof message.accessToken !== "string" || message.accessToken.trim() === "") {
    return { ok: false, error: "Missing access token." };
  }
  const expiresIn = coerceExpiresIn(message.expiresIn);
  if (expiresIn == null) {
    return { ok: false, error: "Invalid expiresIn." };
  }
  return { ok: true, expiresIn };
}

export function tokenRecordFromMessage(message, now = Date.now()) {
  const expiresIn = coerceExpiresIn(message.expiresIn);
  return {
    accessToken: message.accessToken.trim(),
    expiresAt: now + (expiresIn || 0) * 1000,
  };
}
