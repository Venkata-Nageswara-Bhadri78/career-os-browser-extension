import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEBSITE_ORIGINS,
  buildConnectUrl,
  resolveAllowedWebsiteOrigins,
  resolveApiBaseUrl,
  resolveHostPermission,
  toMatchPattern,
} from "../src/lib/envOrigins.js";

describe("env origins", () => {
  it("defaults API to localhost:8080 even over http", () => {
    expect(resolveApiBaseUrl({})).toBe("http://localhost:8080");
    expect(resolveHostPermission({})).toBe("http://localhost:8080/*");
  });

  it("includes default website origins plus extra env origins", () => {
    const origins = resolveAllowedWebsiteOrigins({
      WXT_WEBSITE_ORIGIN: "http://localhost:5173",
      WXT_WEBSITE_ORIGIN_PROD: "https://app.example.com",
    });
    for (const origin of DEFAULT_WEBSITE_ORIGINS) {
      expect(origins).toContain(origin);
    }
    expect(origins).toContain("https://app.example.com");
    expect(origins.join(" ")).not.toContain("*");
  });

  it("opens the website main page with connectExtension=1", () => {
    expect(buildConnectUrl({})).toBe("http://localhost:5173/?connectExtension=1");
  });

  it("omits ports from Chrome match patterns", () => {
    expect(toMatchPattern("http://localhost:5173")).toBe("http://localhost/*");
    expect(toMatchPattern("http://127.0.0.1:3000")).toBe("http://127.0.0.1/*");
    expect(toMatchPattern("https://app.example.com")).toBe("https://app.example.com/*");
  });
});
