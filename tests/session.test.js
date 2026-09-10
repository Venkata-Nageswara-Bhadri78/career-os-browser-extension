import { describe, expect, it } from "vitest";
import { CLOCK_SKEW_MS, connectionFromSession, isExpired, toSafeState } from "../src/lib/session.js";

describe("session", () => {
  it("is disconnected without a token", () => {
    expect(connectionFromSession({})).toBe("disconnected");
    expect(connectionFromSession({ accessToken: "", expiresAt: Date.now() + 60_000 })).toBe(
      "disconnected",
    );
  });

  it("treats expiresAt in the past as expired", () => {
    const session = { accessToken: "jwt", expiresAt: Date.now() - 1 };
    expect(connectionFromSession(session)).toBe("expired");
    expect(isExpired(session)).toBe(true);
  });

  it("applies a 15s clock-skew buffer", () => {
    const now = 1_000_000;
    const session = { accessToken: "jwt", expiresAt: now + CLOCK_SKEW_MS - 1 };
    expect(connectionFromSession(session, now)).toBe("expired");
    expect(connectionFromSession({ accessToken: "jwt", expiresAt: now + CLOCK_SKEW_MS + 1 }, now)).toBe(
      "connected",
    );
  });

  it("never includes the access token in safe state", () => {
    const safe = toSafeState({
      accessToken: "super-secret",
      expiresAt: Date.now() + 60_000,
      lastTabUrl: "https://jobs.example.com/1",
      inFlight: false,
    });
    expect(JSON.stringify(safe)).not.toContain("super-secret");
    expect(safe.connection).toBe("connected");
    expect(safe.lastTabUrl).toBe("https://jobs.example.com/1");
    expect(safe).not.toHaveProperty("accessToken");
  });
});
