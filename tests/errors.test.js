import { describe, expect, it } from "vitest";
import { COPY, mapParseOutcome, shouldOfferFallback } from "../src/lib/errors.js";

describe("error mapper", () => {
  it("clears session on 401 and not on network errors", () => {
    const unauthorized = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 401,
      message: COPY.UNAUTHORIZED,
    });
    expect(unauthorized.kind).toBe("need_connect");
    expect(unauthorized.shouldClearSession).toBe(true);

    const network = mapParseOutcome({ parseKind: "automated", errorKind: "network" });
    expect(network.kind).toBe("error");
    expect(network.shouldClearSession).toBe(false);
    expect(network.message).toBe(COPY.NETWORK);

    const timeout = mapParseOutcome({ parseKind: "automated", errorKind: "timeout" });
    expect(timeout.shouldClearSession).toBe(false);
    expect(timeout.message).toBe(COPY.TIMEOUT);
  });

  it("does not disconnect on parse 403 client-forbidden", () => {
    const forbidden = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 403,
      message: COPY.UNAUTHORIZED_CLIENT,
    });
    expect(forbidden.kind).toBe("error");
    expect(forbidden.shouldClearSession).toBe(false);

    const disabled = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 403,
      message: COPY.EXTENSION_DISABLED,
    });
    expect(disabled.kind).toBe("need_connect");
    expect(disabled.shouldClearSession).toBe(true);
  });

  it("offers fallback only for INVALID JOB URL and the fetch 502 message", () => {
    expect(shouldOfferFallback("automated", 400, COPY.INVALID_JOB_URL)).toBe(true);
    expect(shouldOfferFallback("automated", 502, COPY.FETCH_FAIL)).toBe(true);
    expect(shouldOfferFallback("automated", 502, "The AI provider failed.")).toBe(false);
    expect(shouldOfferFallback("manual", 400, COPY.INVALID_JOB_URL)).toBe(false);
    expect(shouldOfferFallback("automated", 503, "The job page could not be retrieved. Please try again shortly.")).toBe(
      false,
    );

    expect(
      mapParseOutcome({
        parseKind: "automated",
        httpStatus: 400,
        message: COPY.INVALID_JOB_URL,
      }).kind,
    ).toBe("offer_fallback");

    expect(
      mapParseOutcome({
        parseKind: "automated",
        httpStatus: 502,
        message: "model exploded",
      }).offerFallback,
    ).toBe(false);

    expect(
      mapParseOutcome({
        parseKind: "automated",
        httpStatus: 503,
        message: "The AI service is temporarily unavailable. Please try again shortly.",
      }).kind,
    ).toBe("error");
  });

  it("treats 409 as already saved and does not call it a draft", () => {
    const saved = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 409,
      message: "This post was already added to your records.",
    });
    expect(saved.kind).toBe("already_saved");
    expect(saved.shouldClearSession).toBe(false);
    expect(saved.persistedAs).toBeNull();
    expect(saved.draftId).toBeNull();
  });

  it("reads a saved job only from persistedAs JOB", () => {
    const ok = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 200,
      success: true,
      message: "Job created successfully.",
      data: {
        persistedAs: "JOB",
        job: {
          id: 9,
          title: "Engineer",
          company: "Acme",
          sourceUrl: "https://example.com/jobs/123",
          skills: ["Java", "Spring"],
          resumeToJobScore: 80,
        },
        draft: null,
        failureReason: null,
      },
    });
    expect(ok.kind).toBe("job");
    expect(ok.persistedAs).toBe("JOB");
    expect(ok.jobId).toBe(9);
    expect(ok.draftId).toBeNull();
    expect(ok.record.skills).toBe("Java, Spring");
    expect(ok.record.resumeToJobScore).toBe(80);
    expect(ok.record).not.toHaveProperty("requiresManualReview");

    const fromString = mapParseOutcome({
      parseKind: "manual",
      httpStatus: 200,
      success: true,
      message: "Job created successfully.",
      data: {
        persistedAs: "JOB",
        job: { id: 3, title: "PM", company: "Acme", skills: "Java, Spring Boot", resumeToJobScore: 0 },
      },
    });
    expect(fromString.kind).toBe("job");
    expect(fromString.record.skills).toBe("Java, Spring Boot");
    expect(fromString.record.resumeToJobScore).toBe(0);
  });

  it("reads a draft only from persistedAs DRAFT", () => {
    const drafted = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 200,
      success: true,
      message: "Job could not be saved. Stored as a draft.",
      data: {
        persistedAs: "DRAFT",
        job: null,
        draft: {
          id: 4,
          sourceUrl: "https://example.com/jobs/123",
          title: null,
          company: "Acme",
          failureCategory: "VALIDATION",
          failureReason: "title: Title cannot be blank.",
        },
        failureReason: "title: Title cannot be blank.",
      },
    });
    expect(drafted.kind).toBe("draft");
    expect(drafted.draftId).toBe(4);
    expect(drafted.jobId).toBeNull();
    expect(drafted.failureCategory).toBe("VALIDATION");
    expect(drafted.failureReason).toBe("title: Title cannot be blank.");
  });

  it("does not treat a preview payload or a false success flag as a save", () => {
    const preview = mapParseOutcome({
      parseKind: "manual",
      httpStatus: 200,
      success: true,
      message: "Job information extracted successfully. Review and edit before saving.",
      data: { title: "PM", company: "", requiresManualReview: true, skills: ["Java"] },
    });
    expect(preview.kind).toBe("error");
    expect(preview.message).toBe(COPY.AMBIGUOUS);
    expect(preview.jobId).toBeNull();
    expect(preview.draftId).toBeNull();
    expect(preview.record).toBeNull();

    const rejected = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 200,
      success: false,
      message: "The job could not be saved and the draft could not be stored.",
      data: { persistedAs: "JOB", job: { id: 9, title: "Engineer" } },
    });
    expect(rejected.kind).toBe("error");
    expect(rejected.jobId).toBeNull();
    expect(rejected.message).toBe("The job could not be saved and the draft could not be stored.");

    const missingJob = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 200,
      success: true,
      message: "Job created successfully.",
      data: { persistedAs: "JOB", job: null, draft: null },
    });
    expect(missingJob.kind).toBe("error");
    expect(missingJob.message).toBe(COPY.AMBIGUOUS);
  });
});
