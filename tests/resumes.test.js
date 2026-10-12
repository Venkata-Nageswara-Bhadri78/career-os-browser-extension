import { describe, expect, it } from "vitest";
import { chooseResumeId, normalizeResumeList, resumeListError } from "../src/lib/resumes.js";
import { toSafeState } from "../src/lib/session.js";

describe("resume list", () => {
  it("keeps names and the priority flag, and drops file content", () => {
    const resumes = normalizeResumeList([
      { id: 4, originalFilename: "  Other.pdf ", fileSize: 99, highPriority: false, rawText: "secret" },
      { id: 12, originalFilename: "Jane.pdf", fileSize: 10, highPriority: true },
      { id: 12, originalFilename: "duplicate.pdf", highPriority: false },
      { id: "nope", originalFilename: "bad.pdf" },
    ]);
    expect(resumes).toEqual([
      { id: 4, name: "Other.pdf", highPriority: false },
      { id: 12, name: "Jane.pdf", highPriority: true },
    ]);
    expect(JSON.stringify(resumes)).not.toContain("secret");
    expect(JSON.stringify(resumes)).not.toContain("fileSize");
  });

  it("keeps the current choice and otherwise uses the priority resume", () => {
    const resumes = [
      { id: 4, name: "Other.pdf", highPriority: false },
      { id: 12, name: "Jane.pdf", highPriority: true },
    ];
    expect(chooseResumeId(resumes, 4)).toBe(4);
    expect(chooseResumeId(resumes, 99)).toBe(12);
    expect(chooseResumeId([{ id: 4, name: "Other.pdf", highPriority: false }], null)).toBeNull();
  });

  it("accepts a resume array and surfaces profile and auth errors", () => {
    expect(
      resumeListError({
        httpStatus: 200,
        success: true,
        data: [],
      }),
    ).toBeNull();
    expect(resumeListError({ httpStatus: 404, message: "User profile not found." })).toBe(
      "User profile not found.",
    );
    expect(resumeListError({ httpStatus: 401, message: "Unauthorized." })).toBe("Unauthorized.");
  });

  it("does not expose file size or parsed text in safe state", () => {
    const safe = toSafeState({
      accessToken: "super-secret",
      expiresAt: Date.now() + 60_000,
      resumesLoaded: true,
      selectedResumeId: 12,
      resumes: [
        {
          id: 12,
          name: "Jane.pdf",
          highPriority: true,
          fileSize: 10,
          rawText: "secret",
          accessToken: "super-secret",
        },
      ],
    });
    expect(safe.selectedResumeId).toBe(12);
    expect(safe.resumes).toEqual([{ id: 12, name: "Jane.pdf", highPriority: true }]);
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(JSON.stringify(safe)).not.toContain("super-secret");
  });
});
