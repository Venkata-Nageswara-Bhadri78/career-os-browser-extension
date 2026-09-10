import { validateJobUrl } from "./urls.js";

export const MAX_RAW_JOB_TEXT = 50000;

export function clipRawJobText(text) {
  const value = typeof text === "string" ? text : "";
  if (value.length <= MAX_RAW_JOB_TEXT) {
    return value;
  }
  return value.slice(0, MAX_RAW_JOB_TEXT);
}

export function prepareAutomatedPayload({ sourceUrl }) {
  return validateJobUrl(sourceUrl);
}

export function prepareManualPayload({ sourceUrl, rawJobText }) {
  const urlResult = validateJobUrl(sourceUrl);
  if (!urlResult.ok) {
    return urlResult;
  }
  const clipped = clipRawJobText(rawJobText);
  if (clipped.trim() === "") {
    return { ok: false, message: "Pasted job text cannot be blank." };
  }
  return { ok: true, url: urlResult.url, rawJobText: clipped };
}
