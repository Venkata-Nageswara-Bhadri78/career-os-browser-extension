import { parseAutomated, parseManual } from "../src/lib/api.js";
import { getAfterExtractUrl, getAllowedWebsiteOrigins, getApiBaseUrl, getConnectUrl } from "../src/lib/config.js";
import { COPY, mapParseOutcome } from "../src/lib/errors.js";
import { MSG } from "../src/lib/messages.js";
import { clipRawJobText, prepareAutomatedPayload, prepareManualPayload } from "../src/lib/payload.js";
import { connectionFromSession, emptyStore, idleResult, toSafeState } from "../src/lib/session.js";
import {
  originFromSender,
  tokenRecordFromMessage,
  validateExtensionTokenMessage,
} from "../src/lib/tokenHandoff.js";
import { validateJobUrl } from "../src/lib/urls.js";

const STORAGE_KEY = "copilot";
const TOKEN_LOCAL_KEYS = ["accessToken", "expiresAt"];

export default defineBackground(() => {
  let parseInFlight = false;
  let badgeClearTimer = null;
  let websiteTabId = null;

  async function readStore() {
    const sessionData = await browser.storage.session.get(STORAGE_KEY);
    const store = { ...emptyStore(), ...(sessionData[STORAGE_KEY] || {}) };
    if (!store.accessToken) {
      const local = await browser.storage.local.get(TOKEN_LOCAL_KEYS);
      if (local.accessToken && local.expiresAt) {
        store.accessToken = local.accessToken;
        store.expiresAt = local.expiresAt;
      }
    }
    return store;
  }

  async function writeStore(store) {
    await browser.storage.session.set({ [STORAGE_KEY]: store });
    if (store.accessToken && store.expiresAt) {
      await browser.storage.local.set({
        accessToken: store.accessToken,
        expiresAt: store.expiresAt,
      });
    } else {
      await browser.storage.local.remove(TOKEN_LOCAL_KEYS);
    }
  }

  async function patchStore(partial) {
    const store = { ...(await readStore()), ...partial };
    await writeStore(store);
    return store;
  }

  async function broadcast(state) {
    try {
      await browser.runtime.sendMessage({ type: MSG.COPILOT_STATE, state });
    } catch {
      // Popup may be closed.
    }
  }

  async function setBadge(text, color) {
    await browser.action.setBadgeText({ text: text || "" });
    if (text) {
      await browser.action.setBadgeBackgroundColor({ color: color || "#2B7FFF" });
    }
  }

  function cancelBadgeClear() {
    if (badgeClearTimer != null) {
      clearTimeout(badgeClearTimer);
      badgeClearTimer = null;
    }
  }

  function scheduleBadgeClear() {
    cancelBadgeClear();
    badgeClearTimer = setTimeout(() => {
      browser.action.setBadgeText({ text: "" });
      badgeClearTimer = null;
    }, 8000);
  }

  function truncate(value, max) {
    const text = String(value || "").trim();
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, Math.max(0, max - 1))}…`;
  }

  async function notify(id, title, message) {
    try {
      await browser.notifications.create(id, {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/icon-128.png"),
        title: truncate(title, 64) || "Copilot Job Capture",
        message: truncate(message, 180),
      });
    } catch {
      // Notifications may be denied; badge still works.
    }
  }

  async function applyBadgeAndNotify(result) {
    switch (result.kind) {
      case "in_flight":
        cancelBadgeClear();
        await setBadge("...", "#6B7280");
        return;
      case "success": {
        await setBadge("OK", "#059669");
        scheduleBadgeClear();
        const title = truncate(result.preview?.title || "Job captured", 48) || "Job captured";
        const company = truncate(result.preview?.company || "", 48);
        await notify(
          "copilot-ok",
          title,
          company ? `${company}\n${COPY.REVIEW_ON_WEBSITE}` : COPY.REVIEW_ON_WEBSITE,
        );
        return;
      }
      case "already_saved":
        await setBadge("409", "#2B7FFF");
        scheduleBadgeClear();
        await notify("copilot-409", "Copilot Job Capture", result.message || COPY.RATE_LIMIT);
        return;
      case "need_connect":
        cancelBadgeClear();
        await setBadge("!", "#DC2626");
        return;
      default:
        cancelBadgeClear();
        await setBadge("!", "#DC2626");
        await notify("copilot-err", "Copilot Job Capture", result.message || COPY.GENERIC_500);
    }
  }

  async function openConnectTab() {
    const url = getConnectUrl();
    if (websiteTabId != null) {
      try {
        await browser.tabs.sendMessage(websiteTabId, { type: MSG.COPILOT_FOCUS_CONNECT });
        await browser.tabs.update(websiteTabId, { active: true });
        return;
      } catch {
        websiteTabId = null;
      }
    }
    await browser.tabs.create({ url });
  }

  async function openWebsiteTab(url) {
    if (websiteTabId != null) {
      try {
        await browser.tabs.update(websiteTabId, { url, active: true });
        return;
      } catch {
        websiteTabId = null;
      }
    }
    await browser.tabs.create({ url });
  }

  async function acceptTokenMessage(message, senderOrigin) {
    const allowed = getAllowedWebsiteOrigins();
    const check = validateExtensionTokenMessage(message, senderOrigin, allowed);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    const record = tokenRecordFromMessage({ ...message, expiresIn: check.expiresIn });
    const store = await readStore();
    store.accessToken = record.accessToken;
    store.expiresAt = record.expiresAt;
    if (store.lastResult?.kind === "need_connect") {
      store.lastResult = idleResult();
    }
    await writeStore(store);
    const state = toSafeState(store);
    await broadcast(state);
    return { ok: true };
  }

  async function runParse({ parseKind, sourceUrl, rawJobText }) {
    if (parseInFlight) {
      await setBadge("...", "#6B7280");
      return toSafeState(await readStore());
    }

    let store = await readStore();
    const connection = connectionFromSession(store);
    if (connection !== "connected") {
      const result = {
        kind: "need_connect",
        httpStatus: null,
        message: connection === "expired" ? COPY.EXPIRED : COPY.CONNECT_PROMPT,
        preview: null,
        offerFallback: false,
      };
      store = await patchStore({ lastResult: result });
      await applyBadgeAndNotify(result);
      const state = toSafeState(store);
      await broadcast(state);
      return state;
    }

    const prepared =
      parseKind === "manual"
        ? prepareManualPayload({ sourceUrl, rawJobText })
        : prepareAutomatedPayload({ sourceUrl });
    if (!prepared.ok) {
      const result = {
        kind: "error",
        httpStatus: null,
        message: prepared.message,
        preview: null,
        offerFallback: false,
      };
      store = await patchStore({ lastResult: result });
      await applyBadgeAndNotify(result);
      const state = toSafeState(store);
      await broadcast(state);
      return state;
    }

    parseInFlight = true;
    const inflightResult = {
      kind: "in_flight",
      httpStatus: null,
      message: COPY.EXTRACTING_LONG,
      preview: null,
      offerFallback: false,
    };
    store = await patchStore({
      inFlight: true,
      lastResult: inflightResult,
      lastParseSourceUrl: prepared.url,
    });
    await applyBadgeAndNotify(inflightResult);
    await broadcast(toSafeState(store));

    const apiBase = getApiBaseUrl();
    let raw;
    try {
      if (parseKind === "manual") {
        raw = await parseManual(apiBase, store.accessToken, {
          sourceUrl: prepared.url,
          rawJobText: prepared.rawJobText,
        });
      } else {
        raw = await parseAutomated(apiBase, store.accessToken, prepared.url);
      }
    } catch {
      raw = {
        errorKind: "network",
        httpStatus: null,
        message: null,
        data: null,
        retryAfterMs: null,
      };
    }

    const mapped = mapParseOutcome({
      parseKind,
      httpStatus: raw.httpStatus,
      message: raw.message,
      data: raw.data,
      errorKind: raw.errorKind,
    });

    const tokenPatch = mapped.shouldClearSession
      ? { accessToken: null, expiresAt: null }
      : {};
    const retryAfterEpochMs =
      mapped.kind === "rate_limited" ? Date.now() + (raw.retryAfterMs || 60_000) : null;

    const lastResult = {
      kind: mapped.kind,
      httpStatus: mapped.httpStatus,
      message: mapped.message,
      preview: mapped.preview,
      offerFallback: mapped.offerFallback,
    };

    parseInFlight = false;
    store = await patchStore({
      inFlight: false,
      lastResult,
      retryAfterEpochMs,
      ...tokenPatch,
    });
    await applyBadgeAndNotify(mapped);
    const state = toSafeState(store);
    await broadcast(state);
    return state;
  }

  async function confirmFallback() {
    const store = await readStore();
    if (!store.lastResult?.offerFallback) {
      return toSafeState(store);
    }
    if (parseInFlight) {
      return toSafeState(store);
    }

    const originalMessage = store.lastResult.message || "";
    const urlCheck = validateJobUrl(store.lastParseSourceUrl || store.lastTabUrl);
    if (!urlCheck.ok || store.lastTabId == null) {
      const result = {
        kind: "error",
        httpStatus: store.lastResult.httpStatus,
        message: `${originalMessage}\n\n${COPY.FALLBACK_EMPTY}`,
        preview: null,
        offerFallback: false,
      };
      const next = await patchStore({ lastResult: result });
      const state = toSafeState(next);
      await broadcast(state);
      return state;
    }

    let text = "";
    try {
      const injected = await browser.scripting.executeScript({
        target: { tabId: store.lastTabId },
        world: "ISOLATED",
        func: () => (document.body && document.body.innerText) || "",
      });
      text = clipRawJobText(injected?.[0]?.result || "");
    } catch {
      text = "";
    }

    if (!text.trim()) {
      const result = {
        kind: "error",
        httpStatus: store.lastResult.httpStatus,
        message: `${originalMessage}\n\n${COPY.FALLBACK_EMPTY}`,
        preview: null,
        offerFallback: false,
      };
      const next = await patchStore({ lastResult: result, capturedText: "" });
      const state = toSafeState(next);
      await broadcast(state);
      return state;
    }

    await patchStore({ capturedText: text });
    return runParse({
      parseKind: "manual",
      sourceUrl: urlCheck.url,
      rawJobText: text,
    });
  }

  async function handleInternal(message, sender) {
    if (!message || typeof message.type !== "string") {
      return undefined;
    }
    switch (message.type) {
      case MSG.COPILOT_EXTENSION_TOKEN:
        return acceptTokenMessage(message, originFromSender(sender));
      case MSG.COPILOT_GET_STATE:
        return toSafeState(await readStore());
      case MSG.COPILOT_WEBSITE_READY:
        if (sender.tab?.id != null) {
          websiteTabId = sender.tab.id;
        }
        return { ok: true };
      case MSG.COPILOT_POPUP_OPENED: {
        const patch = {};
        if (message.tabId != null) {
          patch.lastTabId = message.tabId;
        }
        if (typeof message.tabUrl === "string") {
          patch.lastTabUrl = message.tabUrl;
        }
        const store = await readStore();
        if (store.lastResult?.kind === "need_connect") {
          patch.lastResult = idleResult();
        }
        const next = await patchStore(patch);
        return toSafeState(next);
      }
      case MSG.COPILOT_CONNECT:
        await openConnectTab();
        return toSafeState(await readStore());
      case MSG.COPILOT_DISCONNECT: {
        const store = await readStore();
        store.accessToken = null;
        store.expiresAt = null;
        await writeStore(store);
        const state = toSafeState(store);
        await broadcast(state);
        return state;
      }
      case MSG.COPILOT_PARSE_AUTOMATED:
        return runParse({
          parseKind: "automated",
          sourceUrl: message.sourceUrl,
        });
      case MSG.COPILOT_PARSE_MANUAL:
        return runParse({
          parseKind: "manual",
          sourceUrl: message.sourceUrl,
          rawJobText: message.rawJobText,
        });
      case MSG.COPILOT_CONFIRM_FALLBACK:
        return confirmFallback();
      case MSG.COPILOT_OPEN_WEBSITE:
        await openWebsiteTab(getAfterExtractUrl());
        return { ok: true };
      default:
        return undefined;
    }
  }

  parseInFlight = false;
  patchStore({ inFlight: false });

  browser.commands.onCommand.addListener((command) => {
    if (command === "open-copilot-panel" && browser.action.openPopup) {
      browser.action.openPopup().catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleInternal(message, sender)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "Something went wrong." }));
    return true;
  });

  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MSG.COPILOT_EXTENSION_TOKEN) {
      return undefined;
    }
    acceptTokenMessage(message, originFromSender(sender))
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "Something went wrong." }));
    return true;
  });
});
