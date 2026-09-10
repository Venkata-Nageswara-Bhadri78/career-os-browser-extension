import { resolveAllowedWebsiteOrigins, toMatchPattern } from "../src/lib/envOrigins.js";
import { MSG } from "../src/lib/messages.js";

export default defineContentScript({
  matches: [
    ...new Set([
      "http://localhost/*",
      "http://127.0.0.1/*",
      ...resolveAllowedWebsiteOrigins(import.meta.env).map(toMatchPattern),
    ]),
  ],
  runAt: "document_idle",
  main() {
    browser.runtime.sendMessage({ type: MSG.COPILOT_WEBSITE_READY }).catch(() => {});
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== MSG.COPILOT_FOCUS_CONNECT) {
        return;
      }
      const next = new URL(window.location.href);
      next.searchParams.set("connectExtension", "1");
      if (next.toString() === window.location.href) {
        window.location.reload();
      } else {
        window.location.assign(next.toString());
      }
    });
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      const data = event.data;
      if (!data || data.type !== MSG.COPILOT_EXTENSION_TOKEN) {
        return;
      }
      browser.runtime.sendMessage({
        type: MSG.COPILOT_EXTENSION_TOKEN,
        accessToken: data.accessToken,
        tokenType: data.tokenType,
        client: data.client,
        expiresIn: data.expiresIn,
      });
    });
  },
});
