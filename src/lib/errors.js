import { toPreview } from "./preview.js";

export const COPY = {
  INVALID_JOB_URL: "INVALID JOB URL",
  FETCH_FAIL: "Unable to access the job posting. Please try again later.",
  UNAUTHORIZED: "Unauthorized.",
  UNAUTHORIZED_CLIENT: "This client is not authorized to access this resource.",
  VERIFY_EMAIL: "Please verify your email before using this feature.",
  EXTENSION_DISABLED: "Browser extension access is disabled.",
  TIMEOUT: "The request took too long. Try again.",
  NETWORK:
    "Could not reach Copilot. Check that the API is running and host_permissions match the API origin.",
  NOT_WEB_URL: "This page is not a web job URL.",
  CONNECT_PROMPT: "Connect Copilot on the website to capture jobs.",
  RATE_LIMIT: "Too many requests. Please try again later.",
  GENERIC_500: "Something went wrong.",
  FALLBACK_EMPTY: "No text was captured. Paste the job posting in Manual Extraction.",
  FALLBACK_CTA:
    "The server could not fetch this page. Capture the visible text from this tab and send it as a manual extraction?",
  SUCCESS_FOOTER:
    "Preview only. Review and save on the Copilot website. This extension cannot save jobs.",
  EXPIRED: "Session expired (about 15 minutes). Connect again.",
  CONNECT_LABEL: "Connect to Copilot",
  CONNECT_SUBTEXT: "Sign in on the website. This extension never asks for your password.",
  DISCONNECT: "Disconnect",
  BUSY: "Extracting…",
  EXTRACTING_LONG: "Extracting… this can take up to a minute.",
  IDLE: "No extraction yet. Use Manual or Automated Extraction to capture a job.",
  REVIEW_ON_WEBSITE: "Review and save on the Copilot website.",
};

export function shouldOfferFallback(parseKind, httpStatus, message) {
  if (parseKind !== "automated") {
    return false;
  }
  if (httpStatus === 400 && message === COPY.INVALID_JOB_URL) {
    return true;
  }
  if (httpStatus === 502 && message === COPY.FETCH_FAIL) {
    return true;
  }
  return false;
}

function safeMessage(message, fallback = COPY.GENERIC_500) {
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return fallback;
}

export function mapParseOutcome({ parseKind, httpStatus, message, data, errorKind }) {
  if (errorKind === "timeout") {
    return {
      kind: "error",
      httpStatus: null,
      message: COPY.TIMEOUT,
      preview: null,
      offerFallback: false,
      shouldClearSession: false,
    };
  }
  if (errorKind === "network") {
    return {
      kind: "error",
      httpStatus: null,
      message: COPY.NETWORK,
      preview: null,
      offerFallback: false,
      shouldClearSession: false,
    };
  }

  if (httpStatus === 200) {
    return {
      kind: "success",
      httpStatus,
      message: safeMessage(
        message,
        "Job information extracted successfully. Review and edit before saving.",
      ),
      preview: toPreview(data),
      offerFallback: false,
      shouldClearSession: false,
    };
  }

  if (httpStatus === 401) {
    return {
      kind: "need_connect",
      httpStatus,
      message: COPY.UNAUTHORIZED,
      preview: null,
      offerFallback: false,
      shouldClearSession: true,
    };
  }

  if (httpStatus === 403) {
    const text = safeMessage(message, COPY.UNAUTHORIZED_CLIENT);
    const killSwitch = text === COPY.EXTENSION_DISABLED;
    return {
      kind: killSwitch ? "need_connect" : "error",
      httpStatus,
      message: text,
      preview: null,
      offerFallback: false,
      shouldClearSession: killSwitch,
    };
  }

  if (httpStatus === 409) {
    return {
      kind: "already_saved",
      httpStatus,
      message: safeMessage(message, "This post was already added to your records."),
      preview: null,
      offerFallback: false,
      shouldClearSession: false,
    };
  }

  if (httpStatus === 429) {
    return {
      kind: "rate_limited",
      httpStatus,
      message: safeMessage(message, COPY.RATE_LIMIT),
      preview: null,
      offerFallback: false,
      shouldClearSession: false,
    };
  }

  const text = safeMessage(message);
  const offerFallback = shouldOfferFallback(parseKind, httpStatus, text);
  return {
    kind: offerFallback ? "offer_fallback" : "error",
    httpStatus,
    message: text,
    preview: null,
    offerFallback,
    shouldClearSession: false,
  };
}
