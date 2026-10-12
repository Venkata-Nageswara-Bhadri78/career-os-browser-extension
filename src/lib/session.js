import { toRecord } from "./preview.js";

export const CLOCK_SKEW_MS = 15_000;

const ATTEMPT_ORIGINS = new Set(["tab", "link", "manual", "fallback"]);
const ATTEMPT_STATUSES = new Set([
  "pending",
  "job",
  "draft",
  "failed",
  "already_saved",
  "rate_limited",
  "need_connect",
]);

export function connectionFromSession(session, now = Date.now()) {
  if (
    !session ||
    typeof session.accessToken !== "string" ||
    session.accessToken.trim() === "" ||
    !session.expiresAt
  ) {
    return "disconnected";
  }
  if (now >= session.expiresAt - CLOCK_SKEW_MS) {
    return "expired";
  }
  return "connected";
}

export function isExpired(session, now = Date.now()) {
  return connectionFromSession(session, now) !== "connected";
}

export function idleResult() {
  return {
    kind: "idle",
    httpStatus: null,
    message: null,
    offerFallback: false,
    persistedAs: null,
    jobId: null,
    draftId: null,
    failureCategory: null,
    failureReason: null,
    record: null,
    attemptId: null,
  };
}

function safeRecord(record) {
  return toRecord(record);
}

function safeAttempt(item) {
  if (!item || typeof item !== "object" || typeof item.id !== "string" || item.id === "") {
    return null;
  }
  const recordBits = safeRecord({
    title: item.title,
    company: item.company,
    sourceUrl: item.sourceUrl,
  });
  return {
    id: item.id,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    sourceUrl: recordBits?.sourceUrl || "",
    origin: ATTEMPT_ORIGINS.has(item.origin) ? item.origin : "tab",
    mode: item.mode === "manual" ? "manual" : "automated",
    status: ATTEMPT_STATUSES.has(item.status) ? item.status : "failed",
    message: typeof item.message === "string" ? item.message : "",
    httpStatus: item.httpStatus ?? null,
    jobId: typeof item.jobId === "number" && Number.isInteger(item.jobId) ? item.jobId : null,
    draftId: typeof item.draftId === "number" && Number.isInteger(item.draftId) ? item.draftId : null,
    failureCategory: typeof item.failureCategory === "string" ? item.failureCategory : null,
    failureReason: typeof item.failureReason === "string" ? item.failureReason : null,
    title: recordBits?.title || null,
    company: recordBits?.company || null,
    offerFallback: Boolean(item.offerFallback),
  };
}

function safeManualDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return null;
  }
  return {
    sourceUrl: typeof draft.sourceUrl === "string" ? draft.sourceUrl.slice(0, 2000) : "",
    rawJobText: typeof draft.rawJobText === "string" ? draft.rawJobText.slice(0, 50000) : "",
  };
}

export function toSafeState(store, now = Date.now()) {
  const raw = store?.lastResult;
  const record = raw && typeof raw === "object" ? safeRecord(raw.record) : null;
  const legacyPreview = raw?.kind === "success";
  const lastResult =
    raw && typeof raw === "object"
      ? {
          kind: legacyPreview ? "error" : raw.kind || "idle",
          httpStatus: raw.httpStatus ?? null,
          message: legacyPreview
            ? "This earlier result was only a preview and was not saved. Send it again."
            : (raw.message ?? null),
          offerFallback: Boolean(raw.offerFallback),
          persistedAs: raw.persistedAs === "JOB" || raw.persistedAs === "DRAFT" ? raw.persistedAs : null,
          jobId: typeof raw.jobId === "number" && Number.isInteger(raw.jobId) ? raw.jobId : null,
          draftId: typeof raw.draftId === "number" && Number.isInteger(raw.draftId) ? raw.draftId : null,
          failureCategory: typeof raw.failureCategory === "string" ? raw.failureCategory : null,
          failureReason: typeof raw.failureReason === "string" ? raw.failureReason : null,
          record,
          attemptId: typeof raw.attemptId === "string" ? raw.attemptId : null,
        }
      : idleResult();

  const attempts = Array.isArray(store?.attempts)
    ? store.attempts.map(safeAttempt).filter(Boolean).slice(0, 30)
    : [];

  return {
    connection: connectionFromSession(store, now),
    lastTabUrl: store?.lastTabUrl || null,
    inFlight: Boolean(store?.inFlight),
    retryAfterEpochMs: store?.retryAfterEpochMs ?? null,
    lastResult,
    attempts,
    manualDraft: safeManualDraft(store?.manualDraft),
    manualTouched: Boolean(store?.manualTouched),
    customUrl: typeof store?.customUrl === "string" ? store.customUrl.slice(0, 2000) : null,
    customTouched: Boolean(store?.customTouched),
    capturedText: typeof store?.capturedText === "string" ? store.capturedText : "",
    resumes: safeResumes(store?.resumes),
    selectedResumeId: safeSelectedResumeId(store?.selectedResumeId, store?.resumes),
    resumesLoaded: Boolean(store?.resumesLoaded),
    resumesError: typeof store?.resumesError === "string" ? store.resumesError : null,
  };
}

function safeResumes(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const resumes = [];
  for (const item of value) {
    if (!item || typeof item.id !== "number" || !Number.isInteger(item.id) || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    resumes.push({
      id: item.id,
      name: name || `Resume ${item.id}`,
      highPriority: item.highPriority === true,
    });
  }
  return resumes;
}

function safeSelectedResumeId(selectedResumeId, resumes) {
  if (typeof selectedResumeId !== "number" || !Number.isInteger(selectedResumeId)) {
    return null;
  }
  const list = safeResumes(resumes);
  return list.some((item) => item.id === selectedResumeId) ? selectedResumeId : null;
}

export function emptyStore() {
  return {
    accessToken: null,
    expiresAt: null,
    lastTabId: null,
    lastTabUrl: null,
    lastParseSourceUrl: null,
    inFlight: false,
    retryAfterEpochMs: null,
    lastResult: idleResult(),
    attempts: [],
    manualDraft: null,
    manualTouched: false,
    customUrl: null,
    customTouched: false,
    resumes: [],
    selectedResumeId: null,
    resumesLoaded: false,
    resumesError: null,
    uiWindowId: null,
    capturedText: "",
  };
}
