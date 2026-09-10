export const DEFAULT_WEBSITE_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function resolveApiBaseUrl(env) {
  return stripTrailingSlash(env?.WXT_API_BASE_URL || "http://localhost:8080");
}

export function resolveWebsiteOrigin(env) {
  return stripTrailingSlash(env?.WXT_WEBSITE_ORIGIN || "http://localhost:5173");
}

export function resolveWebsiteLoginPath(env) {
  const path = String(env?.WXT_WEBSITE_LOGIN_PATH || "/login").trim() || "/login";
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveWebsiteAfterExtractPath(env) {
  const raw = env?.WXT_WEBSITE_AFTER_EXTRACT_PATH;
  if (raw == null || String(raw).trim() === "") {
    return "/";
  }
  const path = String(raw).trim();
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveAllowedWebsiteOrigins(env) {
  const extra = String(env?.WXT_WEBSITE_ORIGINS || "")
    .split(",")
    .map(stripTrailingSlash)
    .filter(Boolean);
  const prod = stripTrailingSlash(env?.WXT_WEBSITE_ORIGIN_PROD || "");
  const set = new Set([
    ...DEFAULT_WEBSITE_ORIGINS,
    resolveWebsiteOrigin(env),
    ...extra,
  ]);
  if (prod) {
    set.add(prod);
  }
  return [...set];
}

export function toMatchPattern(origin) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return `${stripTrailingSlash(origin)}/*`;
  }
}

export function resolveHostPermission(env) {
  return `${resolveApiBaseUrl(env)}/*`;
}

export function buildConnectUrl(env) {
  const origin = resolveWebsiteOrigin(env);
  const path = resolveWebsiteAfterExtractPath(env);
  const url = new URL(path, `${origin}/`);
  url.searchParams.set("connectExtension", "1");
  return url.toString();
}

export function buildAfterExtractUrl(env) {
  const origin = resolveWebsiteOrigin(env);
  const path = resolveWebsiteAfterExtractPath(env);
  return new URL(path, `${origin}/`).toString();
}
