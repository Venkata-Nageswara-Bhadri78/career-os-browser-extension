import { COPY } from "./errors.js";

export function normalizeResumeList(data) {
  if (!Array.isArray(data)) {
    return [];
  }
  const seen = new Set();
  const resumes = [];
  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    if (typeof item.id !== "number" || !Number.isInteger(item.id)) {
      continue;
    }
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    const filename = typeof item.originalFilename === "string" ? item.originalFilename.trim() : "";
    resumes.push({
      id: item.id,
      name: filename || `Resume ${item.id}`,
      highPriority: item.highPriority === true,
    });
  }
  return resumes;
}

export function chooseResumeId(resumes, previousId) {
  const list = Array.isArray(resumes) ? resumes : [];
  if (list.some((item) => item.id === previousId)) {
    return previousId;
  }
  const priority = list.find((item) => item.highPriority);
  return priority ? priority.id : null;
}

export function resumeListError({ httpStatus, message, errorKind, success, data }) {
  if (errorKind === "timeout") {
    return COPY.TIMEOUT;
  }
  if (errorKind === "network") {
    return COPY.NETWORK;
  }
  if (httpStatus === 401) {
    return COPY.UNAUTHORIZED;
  }
  if (httpStatus === 403) {
    return typeof message === "string" && message.trim() ? message.trim() : COPY.UNAUTHORIZED_CLIENT;
  }
  if (httpStatus === 404) {
    return typeof message === "string" && message.trim() ? message.trim() : "User profile not found.";
  }
  if (httpStatus === 200 && success !== false && Array.isArray(data)) {
    return null;
  }
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return COPY.GENERIC_500;
}
