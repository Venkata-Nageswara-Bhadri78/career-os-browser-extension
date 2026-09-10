import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import {
  resolveAllowedWebsiteOrigins,
  resolveApiBaseUrl,
  toMatchPattern,
} from "./src/lib/envOrigins.js";
import {
  ACTION_TITLE,
  EXTENSION_NAME,
  MANIFEST_KEY,
} from "./src/lib/extensionIdentity.js";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  targetBrowsers: ["chrome"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: () => {
    const env = process.env;
    const apiBase = resolveApiBaseUrl(env);
    const websiteMatches = [
      ...new Set(resolveAllowedWebsiteOrigins(env).map(toMatchPattern)),
    ];
    return {
      name: EXTENSION_NAME,
      description:
        "Capture a job posting and send it to Copilot for extraction. Review and save on the website.",
      version: "1.0.0",
      minimum_chrome_version: "116",
      key: MANIFEST_KEY,
      action: {
        default_title: ACTION_TITLE,
        default_popup: "popup.html",
        default_icon: {
          16: "icons/icon-16.png",
          32: "icons/icon-32.png",
          48: "icons/icon-48.png",
          128: "icons/icon-128.png",
        },
      },
      icons: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
      },
      permissions: ["storage", "activeTab", "scripting", "notifications"],
      host_permissions: [`${apiBase}/*`],
      externally_connectable: {
        matches: websiteMatches,
      },
      commands: {
        "open-copilot-panel": {
          suggested_key: {
            default: "Alt+Shift+C",
          },
          description: "Open Copilot Job Capture",
        },
      },
    };
  },
});
