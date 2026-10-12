export const MAX_ATTEMPTS = 30;

const ORIGINS = new Set(["tab", "link", "manual", "fallback"]);

export function attemptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function statusFromKind(kind) {
  switch (kind) {
    case "job":
      return "job";
    case "draft":
      return "draft";
    case "already_saved":
      return "already_saved";
    case "rate_limited":
      return "rate_limited";
    case "need_connect":
      return "need_connect";
    case "in_flight":
      return "pending";
    case "idle":
    case null:
    case undefined:
      return "idle";
    default:
      return "failed";
  }
}

export function dotColor(status) {
  switch (status) {
    case "job":
      return "#059669";
    case "draft":
      return "#D97706";
    case "pending":
      return "#6B7280";
    case "already_saved":
    case "rate_limited":
      return "#2B7FFF";
    default:
      return "#DC2626";
  }
}

export function badgeForKind(kind) {
  const status = statusFromKind(kind);
  if (status === "idle") {
    return { text: "", color: "#2B7FFF" };
  }
  if (status === "pending") {
    return { text: "...", color: "#6B7280" };
  }
  return { text: "●", color: dotColor(status) };
}

export function dotLabel(status) {
  switch (status) {
    case "job":
      return "Saved";
    case "draft":
      return "Stored as a draft";
    case "pending":
      return "Submitting";
    case "already_saved":
      return "Already saved";
    case "rate_limited":
      return "Too many requests";
    case "need_connect":
      return "Connect required";
    case "failed":
      return "Failed. Send again to retry.";
    default:
      return "";
  }
}

export function attemptStatusLabel(status) {
  switch (status) {
    case "job":
      return "Saved";
    case "draft":
      return "Draft";
    case "pending":
      return "Submitting";
    case "already_saved":
      return "Already saved";
    case "rate_limited":
      return "Too many requests";
    case "need_connect":
      return "Connect required";
    default:
      return "Failed";
  }
}

export function originLabel(origin) {
  switch (origin) {
    case "link":
      return "Custom URL";
    case "manual":
      return "Pasted text";
    case "fallback":
      return "Captured text";
    default:
      return "Current tab";
  }
}

export function latestStatus(state) {
  if (state?.inFlight || state?.lastResult?.kind === "in_flight") {
    return "pending";
  }
  return statusFromKind(state?.lastResult?.kind);
}

export function createAttempt({
  id = attemptId(),
  createdAt = Date.now(),
  sourceUrl = "",
  origin = "tab",
  mode = "automated",
  status = "failed",
  message = "",
  httpStatus = null,
  jobId = null,
  draftId = null,
  failureCategory = null,
  failureReason = null,
  title = null,
  company = null,
  offerFallback = false,
} = {}) {
  return {
    id,
    createdAt,
    sourceUrl: sourceUrl || "",
    origin: ORIGINS.has(origin) ? origin : "tab",
    mode: mode === "manual" ? "manual" : "automated",
    status,
    message: message || "",
    httpStatus,
    jobId: jobId ?? null,
    draftId: draftId ?? null,
    failureCategory: failureCategory || null,
    failureReason: failureReason || null,
    title: title || null,
    company: company || null,
    offerFallback: Boolean(offerFallback),
  };
}

export function upsertAttempt(attempts, attempt) {
  const list = Array.isArray(attempts) ? attempts.filter(Boolean) : [];
  const index = list.findIndex((item) => item.id === attempt.id);
  if (index === -1) {
    return [attempt, ...list].slice(0, MAX_ATTEMPTS);
  }
  const next = list.slice();
  next[index] = { ...list[index], ...attempt, createdAt: list[index].createdAt };
  return next.slice(0, MAX_ATTEMPTS);
}

export function finishAttempt(pending, mapped, offerFallback) {
  const record = mapped?.record;
  return {
    ...pending,
    status: statusFromKind(mapped?.kind),
    message: mapped?.message || "",
    httpStatus: mapped?.httpStatus ?? null,
    jobId: mapped?.jobId ?? null,
    draftId: mapped?.draftId ?? null,
    failureCategory: mapped?.failureCategory || null,
    failureReason: mapped?.failureReason || null,
    title: record?.title || null,
    company: record?.company || null,
    sourceUrl: record?.sourceUrl || pending.sourceUrl,
    offerFallback: Boolean(offerFallback),
  };
}

export function lastResultFromMapped(mapped, id, offerFallback = false) {
  return {
    kind: mapped?.kind || "error",
    httpStatus: mapped?.httpStatus ?? null,
    message: mapped?.message ?? null,
    offerFallback: Boolean(offerFallback),
    persistedAs: mapped?.persistedAs ?? null,
    jobId: mapped?.jobId ?? null,
    draftId: mapped?.draftId ?? null,
    failureCategory: mapped?.failureCategory ?? null,
    failureReason: mapped?.failureReason ?? null,
    record: mapped?.record ?? null,
    attemptId: id ?? null,
  };
}

export function interruptPending(attempts, message) {
  if (!Array.isArray(attempts)) {
    return [];
  }
  return attempts.map((item) => {
    if (!item || item.status !== "pending") {
      return item;
    }
    return {
      ...item,
      status: "failed",
      message,
      offerFallback: false,
    };
  });
}

export function settleInterruptedSession(store, message) {
  const attempts = interruptPending(store?.attempts, message);
  const last = store?.lastResult;
  if (last?.kind === "in_flight") {
    return {
      attempts,
      inFlight: false,
      lastResult: lastResultFromMapped(
        { kind: "error", httpStatus: null, message, record: null },
        last.attemptId ?? null,
        false,
      ),
    };
  }
  return {
    attempts,
    inFlight: false,
    lastResult: last || lastResultFromMapped({ kind: "idle", message: null }, null, false),
  };
}
