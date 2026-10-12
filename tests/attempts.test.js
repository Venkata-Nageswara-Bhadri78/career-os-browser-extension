import { describe, expect, it } from "vitest";
import {
  badgeForKind,
  createAttempt,
  finishAttempt,
  latestStatus,
  MAX_ATTEMPTS,
  settleInterruptedSession,
  upsertAttempt,
} from "../src/lib/attempts.js";

describe("submission attempts", () => {
  it("updates a pending attempt in place and caps the session list", () => {
    const pending = createAttempt({
      id: "1",
      status: "pending",
      createdAt: 10,
      sourceUrl: "https://jobs.example.com/1",
      origin: "tab",
    });
    const done = finishAttempt(
      pending,
      {
        kind: "job",
        message: "Job created successfully.",
        httpStatus: 200,
        jobId: 9,
        record: { title: "Engineer", company: "Acme", sourceUrl: "https://jobs.example.com/1" },
      },
      false,
    );
    const list = upsertAttempt([pending], done);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("job");
    expect(list[0].createdAt).toBe(10);
    expect(list[0].jobId).toBe(9);
    expect(list[0].title).toBe("Engineer");
    expect(list[0].offerFallback).toBe(false);

    let many = [];
    for (let index = 0; index < MAX_ATTEMPTS + 10; index += 1) {
      many = upsertAttempt(many, createAttempt({ id: String(index), status: "failed" }));
    }
    expect(many).toHaveLength(MAX_ATTEMPTS);
    expect(many[0].id).toBe(String(MAX_ATTEMPTS + 9));
  });

  it("marks an interrupted request as a failure", () => {
    const settled = settleInterruptedSession(
      {
        attempts: [createAttempt({ id: "p", status: "pending", message: "Submitting" })],
        lastResult: { kind: "in_flight", attemptId: "p" },
      },
      "The request was interrupted. Try again.",
    );
    expect(settled.inFlight).toBe(false);
    expect(settled.attempts[0].status).toBe("failed");
    expect(settled.attempts[0].message).toBe("The request was interrupted. Try again.");
    expect(settled.lastResult.kind).toBe("error");
    expect(settled.lastResult.attemptId).toBe("p");
  });

  it("paints one dot color for each outcome", () => {
    expect(badgeForKind("job")).toEqual({ text: "●", color: "#059669" });
    expect(badgeForKind("draft")).toEqual({ text: "●", color: "#D97706" });
    expect(badgeForKind("error").color).toBe("#DC2626");
    expect(badgeForKind("offer_fallback").color).toBe("#DC2626");
    expect(badgeForKind("already_saved").color).toBe("#2B7FFF");
    expect(badgeForKind("in_flight")).toEqual({ text: "...", color: "#6B7280" });
    expect(badgeForKind("idle").text).toBe("");
    expect(latestStatus({ inFlight: true, lastResult: { kind: "job" } })).toBe("pending");
    expect(latestStatus({ lastResult: { kind: "draft" } })).toBe("draft");
    expect(latestStatus({ lastResult: { kind: "idle" } })).toBe("idle");
  });
});
