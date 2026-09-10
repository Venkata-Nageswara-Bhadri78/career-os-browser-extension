export const CLOCK_SKEW_MS = 15_000;

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
    preview: null,
    offerFallback: false,
  };
}

export function toSafeState(store, now = Date.now()) {
  const raw = store?.lastResult;
  const lastResult =
    raw && typeof raw === "object"
      ? {
          kind: raw.kind || "idle",
          httpStatus: raw.httpStatus ?? null,
          message: raw.message ?? null,
          preview: raw.preview ?? null,
          offerFallback: Boolean(raw.offerFallback),
        }
      : idleResult();

  return {
    connection: connectionFromSession(store, now),
    lastTabUrl: store?.lastTabUrl || null,
    inFlight: Boolean(store?.inFlight),
    retryAfterEpochMs: store?.retryAfterEpochMs ?? null,
    lastResult,
    capturedText: typeof store?.capturedText === "string" ? store.capturedText : "",
  };
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
    uiWindowId: null,
    capturedText: "",
  };
}
