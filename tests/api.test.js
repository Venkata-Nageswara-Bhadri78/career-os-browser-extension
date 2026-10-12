import { describe, expect, it, vi } from "vitest";
import {
  AUTOMATED_PARSE_PATH,
  MANUAL_PARSE_PATH,
  RESUME_LIST_PATH,
  listResumes,
  parseAutomated,
  parseManual,
  parseRetryAfterMs,
} from "../src/lib/api.js";

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return headers[name] || headers[name.toLowerCase()] || null;
      },
    },
    json: async () => body,
  };
}

describe("parse API client", () => {
  it("calls only the automated parse path with sourceUrl", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        message: "ok",
        data: { title: "Eng" },
      }),
    );
    const result = await parseAutomated("http://localhost:8080", "ext-jwt", "https://jobs.example.com/1", {
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`http://localhost:8080${AUTOMATED_PARSE_PATH}`);
    expect(url).not.toContain("/api/v1/auth/");
    expect(url).not.toContain("/api/v1/jobs");
    expect(url).not.toContain("/api/v1/ai");
    expect(init.headers.Authorization).toBe("Bearer ext-jwt");
    expect(JSON.parse(init.body)).toEqual({ sourceUrl: "https://jobs.example.com/1", isAuto: true });
    expect(JSON.parse(init.body).isAuto).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it("calls only the manual parse path with sourceUrl and rawJobText", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { success: true, message: "ok", data: { title: "PM" } }),
    );
    await parseManual(
      "http://localhost:8080",
      "ext-jwt",
      { sourceUrl: "https://jobs.example.com/1", rawJobText: "Role details" },
      { fetchImpl },
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`http://localhost:8080${MANUAL_PARSE_PATH}`);
    expect(JSON.parse(init.body)).toEqual({
      sourceUrl: "https://jobs.example.com/1",
      rawJobText: "Role details",
      isAuto: true,
    });
    expect(JSON.parse(init.body)).not.toHaveProperty("resume");
  });

  it("sends the selected resume id on both parse calls", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { success: true, message: "ok", data: { persistedAs: "JOB", job: { id: 1 } } }),
    );
    await parseAutomated("http://localhost:8080", "ext-jwt", "https://jobs.example.com/1", {
      fetchImpl,
      resumeId: 12,
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).resume).toBe(12);

    await parseManual(
      "http://localhost:8080",
      "ext-jwt",
      { sourceUrl: "https://jobs.example.com/1", rawJobText: "Role details", resumeId: 12 },
      { fetchImpl },
    );
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).resume).toBe(12);
  });

  it("lists resume names from the collection endpoint only", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        message: "ok",
        data: [{ id: 12, originalFilename: "Jane.pdf", fileSize: 10, highPriority: true }],
      }),
    );
    const result = await listResumes("http://localhost:8080/", "ext-jwt", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`http://localhost:8080${RESUME_LIST_PATH}`);
    expect(url).not.toMatch(/\/resumes\/\d+/);
    expect(url).not.toContain("/parsed");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer ext-jwt");
    expect(result.data[0].originalFilename).toBe("Jane.pdf");
  });

  it("keeps isAuto true when a caller passes a different body", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { success: true, message: "ok", data: { persistedAs: "JOB", job: { id: 1 } } }),
    );
    await parseAutomated("http://localhost:8080", "ext-jwt", "https://jobs.example.com/1", {
      fetchImpl,
      body: { sourceUrl: "https://evil.example", isAuto: false },
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      sourceUrl: "https://jobs.example.com/1",
      isAuto: true,
    });
  });

  it("maps abort to timeout and failed fetch to network", async () => {
    const aborting = vi.fn((_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
    );
    const timeout = await parseAutomated("http://localhost:8080", "tok", "https://jobs.example.com/1", {
      fetchImpl: aborting,
      timeoutMs: 5,
    });
    expect(timeout.errorKind).toBe("timeout");

    const network = await parseAutomated("http://localhost:8080", "tok", "https://jobs.example.com/1", {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(network.errorKind).toBe("network");
  });

  it("parses Retry-After seconds", () => {
    expect(parseRetryAfterMs("12", 0)).toBe(12_000);
  });
});
