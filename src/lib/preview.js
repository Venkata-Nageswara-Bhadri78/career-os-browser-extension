function asString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function asId(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return null;
}

function asScore(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return null;
}

function clip(value, max) {
  const text = asString(value).trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function skillsToString(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export function toRecord(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return {
    id: asId(data.id),
    sourceUrl: asString(data.sourceUrl).trim(),
    title: asString(data.title).trim(),
    company: asString(data.company).trim(),
    location: asString(data.location).trim(),
    employmentType: asString(data.employmentType).trim(),
    workMode: asString(data.workMode).trim(),
    experience: asString(data.experience).trim(),
    salary: asString(data.salary).trim(),
    education: asString(data.education).trim(),
    department: asString(data.department).trim(),
    industry: asString(data.industry).trim(),
    sourcePlatform: asString(data.sourcePlatform).trim(),
    skills: clip(skillsToString(data.skills), 300),
    description: clip(data.description, 400),
    resumeToJobScore: asScore(data.resumeToJobScore),
    failureCategory: typeof data.failureCategory === "string" ? data.failureCategory.trim() : "",
    failureReason: clip(data.failureReason, 1000),
  };
}
