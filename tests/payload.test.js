import { describe, expect, it } from "vitest";
import { clipRawJobText, MAX_RAW_JOB_TEXT, prepareManualPayload } from "../src/lib/payload.js";

describe("manual payload", () => {
  it("rejects blank job text", () => {
    const result = prepareManualPayload({
      sourceUrl: "https://jobs.example.com/1",
      rawJobText: "   ",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Pasted job text cannot be blank.");
  });

  it("clips text to 50000 characters", () => {
    const raw = "x".repeat(MAX_RAW_JOB_TEXT + 25);
    expect(clipRawJobText(raw)).toHaveLength(MAX_RAW_JOB_TEXT);
    const result = prepareManualPayload({
      sourceUrl: "https://jobs.example.com/1",
      rawJobText: raw,
    });
    expect(result.ok).toBe(true);
    expect(result.rawJobText).toHaveLength(MAX_RAW_JOB_TEXT);
  });
});
