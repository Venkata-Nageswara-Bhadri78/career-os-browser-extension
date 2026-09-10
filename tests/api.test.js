import { describe, expect, it, vi } from "vitest";
import {
  AUTOMATED_PARSE_PATH,
  MANUAL_PARSE_PATH,
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
    expect(JSON.parse(init.body)).toEqual({ sourceUrl: "https://jobs.example.com/1" });
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
