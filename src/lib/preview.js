function asString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

export function toPreview(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const skills = Array.isArray(data.skills)
    ? data.skills.filter((item) => typeof item === "string")
    : [];
  return {
    sourceUrl: asString(data.sourceUrl),
    originalDescription: asString(data.originalDescription),
    description: asString(data.description),
    title: asString(data.title),
    company: asString(data.company),
    location: asString(data.location),
    employmentType: asString(data.employmentType),
    workMode: asString(data.workMode),
    experience: asString(data.experience),
    salary: asString(data.salary),
    education: asString(data.education),
    department: asString(data.department),
    industry: asString(data.industry),
    sourcePlatform: asString(data.sourcePlatform),
    skills,
    requiresManualReview: Boolean(data.requiresManualReview),
  };
}
