import { describe, expect, it } from "vitest";
import { MSG } from "../src/lib/messages.js";
import { originFromSender, validateExtensionTokenMessage } from "../src/lib/tokenHandoff.js";

const allowed = ["http://localhost:5173"];
const good = {
  type: MSG.COPILOT_EXTENSION_TOKEN,
  accessToken: "jwt",
  tokenType: "Bearer",
  client: "browser-extension",
  expiresIn: 900,
};

describe("external token message", () => {
  it("accepts a valid website payload", () => {
    expect(validateExtensionTokenMessage(good, "http://localhost:5173", allowed).ok).toBe(true);
  });

  it("rejects a bad origin", () => {
    const result = validateExtensionTokenMessage(good, "https://evil.example", allowed);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/origin/i);
  });

  it("rejects client !== browser-extension", () => {
    const result = validateExtensionTokenMessage(
      { ...good, client: "web" },
      "http://localhost:5173",
      allowed,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing token", () => {
    const result = validateExtensionTokenMessage(
      { ...good, accessToken: "" },
      "http://localhost:5173",
      allowed,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts expiresIn as a numeric string", () => {
    const result = validateExtensionTokenMessage(
      { ...good, expiresIn: "900" },
      "http://localhost:5173",
      allowed,
    );
    expect(result.ok).toBe(true);
    expect(result.expiresIn).toBe(900);
  });
});

describe("originFromSender", () => {
  it("prefers the tab URL over a chrome-extension sender origin", () => {
    expect(
      originFromSender({
        origin: "chrome-extension://lghllhgdcekacmdoolnekkkoffcmcaeo",
        tab: { url: "http://localhost:5173/dashboard" },
      }),
    ).toBe("http://localhost:5173");
  });

  it("ignores chrome-extension origins", () => {
    expect(
      originFromSender({
        origin: "chrome-extension://lghllhgdcekacmdoolnekkkoffcmcaeo",
      }),
    ).toBe("");
  });
});
