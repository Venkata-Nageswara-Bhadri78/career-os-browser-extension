import {
  buildAfterExtractUrl,
  buildConnectUrl,
  resolveAllowedWebsiteOrigins,
  resolveApiBaseUrl,
  resolveWebsiteOrigin,
} from "./envOrigins.js";

function env() {
  return import.meta.env;
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl(env());
}

export function getWebsiteOrigin() {
  return resolveWebsiteOrigin(env());
}

export function getConnectUrl() {
  return buildConnectUrl(env());
}

export function getAfterExtractUrl() {
  return buildAfterExtractUrl(env());
}

export function getAllowedWebsiteOrigins() {
  return resolveAllowedWebsiteOrigins(env());
}
