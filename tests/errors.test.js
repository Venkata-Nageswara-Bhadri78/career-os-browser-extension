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

  it("treats 409 as already saved and 200 with requiresManualReview as success", () => {
    const saved = mapParseOutcome({
      parseKind: "automated",
      httpStatus: 409,
      message: "This post was already added to your records.",
    });
    expect(saved.kind).toBe("already_saved");
    expect(saved.shouldClearSession).toBe(false);

    const ok = mapParseOutcome({
      parseKind: "manual",
      httpStatus: 200,
      message: "Job information extracted successfully. Review and edit before saving.",
      data: { title: "PM", company: "", requiresManualReview: true, skills: ["Java"] },
    });
    expect(ok.kind).toBe("success");
    expect(ok.preview.requiresManualReview).toBe(true);
    expect(ok.preview.skills).toEqual(["Java"]);
  });
});
