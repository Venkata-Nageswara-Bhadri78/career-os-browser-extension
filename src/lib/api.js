export const AUTOMATED_PARSE_PATH = "/api/v1/automated-job-extraction/parse";
export const MANUAL_PARSE_PATH = "/api/v1/job-extraction/parse";
export const PARSE_TIMEOUT_MS = 90_000;

export function joinApi(apiBaseUrl, path) {
  return `${String(apiBaseUrl).replace(/\/+$/, "")}${path}`;
}

export function parseRetryAfterMs(header, now = Date.now()) {
  if (header == null || header === "") {
    return 60_000;
  }
  const trimmed = String(header).trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - now);
  }
  return 60_000;
}

export async function postJson({
  url,
  accessToken,
  body,
  fetchImpl = fetch,
  timeoutMs = PARSE_TIMEOUT_MS,
  now = Date.now,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: "omit",
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const retryHeader =
      typeof response.headers?.get === "function"
        ? response.headers.get("Retry-After") || response.headers.get("retry-after")
        : null;
    return {
      errorKind: null,
      httpStatus: response.status,
      success: Boolean(payload?.success),
      message: typeof payload?.message === "string" ? payload.message : null,
      data: payload?.data ?? null,
      retryAfterMs: response.status === 429 ? parseRetryAfterMs(retryHeader, now()) : null,
    };
  } catch (err) {
    if (err && (err.name === "AbortError" || err.code === 20)) {
      return {
        errorKind: "timeout",
        httpStatus: null,
        success: false,
        message: null,
        data: null,
        retryAfterMs: null,
      };
    }
    return {
      errorKind: "network",
      httpStatus: null,
      success: false,
      message: null,
      data: null,
      retryAfterMs: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseAutomated(apiBaseUrl, accessToken, sourceUrl, options = {}) {
  return postJson({
    url: joinApi(apiBaseUrl, AUTOMATED_PARSE_PATH),
    accessToken,
    body: { sourceUrl },
    ...options,
  });
}

export function parseManual(apiBaseUrl, accessToken, { sourceUrl, rawJobText }, options = {}) {
  return postJson({
    url: joinApi(apiBaseUrl, MANUAL_PARSE_PATH),
    accessToken,
    body: { sourceUrl, rawJobText },
    ...options,
  });
}
