import { describe, expect, it } from "vitest";
import { MAX_URL_LENGTH, validateJobUrl } from "../src/lib/urls.js";

describe("validateJobUrl", () => {
  it("accepts http and https URLs", () => {
    expect(validateJobUrl("https://jobs.example.com/role").ok).toBe(true);
    expect(validateJobUrl("http://localhost:3000/jobs/1").ok).toBe(true);
  });

  it("rejects javascript, data, file, and chrome schemes", () => {
    expect(validateJobUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateJobUrl("data:text/html,hi").ok).toBe(false);
    expect(validateJobUrl("file:///tmp/job.html").ok).toBe(false);
    expect(validateJobUrl("chrome://extensions").ok).toBe(false);
  });

  it("rejects missing host", () => {
    expect(validateJobUrl("https://").ok).toBe(false);
    expect(validateJobUrl("http://").ok).toBe(false);
  });

  it("rejects length 2001", () => {
    const prefix = "https://example.com/";
    const url = prefix + "a".repeat(MAX_URL_LENGTH + 1 - prefix.length);
    expect(url.length).toBe(MAX_URL_LENGTH + 1);
    expect(validateJobUrl(url).ok).toBe(false);
    expect(validateJobUrl(url).message).toMatch(/2000/);
  });

  it("rejects blank", () => {
    expect(validateJobUrl("").message).toBe("Job URL cannot be blank.");
    expect(validateJobUrl("   ").message).toBe("Job URL cannot be blank.");
  });
});
