import { toRecord } from "./preview.js";

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
  FALLBACK_EMPTY: "No text was captured. Paste the job posting in Capture.",
  FALLBACK_CTA:
    "The server could not fetch this page. Capture the visible text from this tab and submit it?",
  EXPIRED: "Session expired (about 15 minutes). Connect again.",
  CONNECT_LABEL: "Connect to Copilot",
  CONNECT_SUBTEXT: "Sign in on the website. This extension never asks for your password.",
  DISCONNECT: "Disconnect",
  BUSY: "Submitting…",
  EXTRACTING_LONG: "Submitting… this can take up to a minute.",
  IDLE: "No submissions yet in this browser session.",
  JOB_SAVED: "Saved to your jobs.",
  DRAFT_STORED: "Stored as a draft. Finish it on the Copilot website.",
  AMBIGUOUS: "The server did not say whether this job was saved or stored as a draft.",
  INTERRUPTED: "The request was interrupted. Try again.",
  JOB_CREATED: "Job created successfully.",
  DRAFT_MESSAGE: "Job could not be saved. Stored as a draft.",
};

export function failureCategoryHint(category) {
  switch (category) {
    case "VALIDATION":
      return "Required job fields are missing or invalid. The usual case is a blank title or company.";
    case "PERSISTENCE":
      return "The row could not be stored because of a data conflict that is not already saved.";
    case "EXTERNAL":
      return "The model could not structure the posting. The URL and the raw text were kept.";
    case "UNEXPECTED":
      return "The save failed for another reason.";
    default:
      return "";
  }
}

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

function outcome(partial) {
  return {
    kind: "error",
    httpStatus: null,
    message: COPY.GENERIC_500,
    offerFallback: false,
    shouldClearSession: false,
    persistedAs: null,
    jobId: null,
    draftId: null,
    failureCategory: null,
    failureReason: null,
    record: null,
    ...partial,
  };
}

function ambiguous(httpStatus) {
  return outcome({
    kind: "error",
    httpStatus,
    message: COPY.AMBIGUOUS,
  });
}

export function mapParseOutcome({ parseKind, httpStatus, message, data, errorKind, success }) {
  if (errorKind === "timeout") {
    return outcome({
      kind: "error",
      message: COPY.TIMEOUT,
    });
  }
  if (errorKind === "network") {
    return outcome({
      kind: "error",
      message: COPY.NETWORK,
    });
  }

  if (httpStatus === 200) {
    if (success === false) {
      return outcome({
        kind: "error",
        httpStatus,
        message: safeMessage(message),
      });
    }
    if (data?.persistedAs === "JOB" && data.job && typeof data.job === "object" && !Array.isArray(data.job)) {
      const record = toRecord(data.job);
      return outcome({
        kind: "job",
        httpStatus,
        message: safeMessage(message, COPY.JOB_CREATED),
        persistedAs: "JOB",
        jobId: record?.id ?? null,
        record,
      });
    }
    if (data?.persistedAs === "DRAFT" && data.draft && typeof data.draft === "object" && !Array.isArray(data.draft)) {
      const record = toRecord(data.draft);
      const failureReason =
        (typeof data.failureReason === "string" && data.failureReason.trim()) ||
        record?.failureReason ||
        "";
      const failureCategory =
        (typeof data.draft.failureCategory === "string" && data.draft.failureCategory.trim()) ||
        record?.failureCategory ||
        "";
      return outcome({
        kind: "draft",
        httpStatus,
        message: safeMessage(message, COPY.DRAFT_MESSAGE),
        persistedAs: "DRAFT",
        draftId: record?.id ?? null,
        failureCategory: failureCategory || null,
        failureReason: failureReason || null,
        record,
      });
    }
    return ambiguous(httpStatus);
  }

  if (httpStatus === 401) {
    return outcome({
      kind: "need_connect",
      httpStatus,
      message: COPY.UNAUTHORIZED,
      shouldClearSession: true,
    });
  }

  if (httpStatus === 403) {
    const text = safeMessage(message, COPY.UNAUTHORIZED_CLIENT);
    const killSwitch = text === COPY.EXTENSION_DISABLED;
    return outcome({
      kind: killSwitch ? "need_connect" : "error",
      httpStatus,
      message: text,
      shouldClearSession: killSwitch,
    });
  }

  if (httpStatus === 409) {
    return outcome({
      kind: "already_saved",
      httpStatus,
      message: safeMessage(message, "This post was already added to your records."),
    });
  }

  if (httpStatus === 429) {
    return outcome({
      kind: "rate_limited",
      httpStatus,
      message: safeMessage(message, COPY.RATE_LIMIT),
    });
  }

  const text = safeMessage(message);
  const offerFallback = shouldOfferFallback(parseKind, httpStatus, text);
  return outcome({
    kind: offerFallback ? "offer_fallback" : "error",
    httpStatus,
    message: text,
    offerFallback,
  });
}
