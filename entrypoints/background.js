import { listResumes, parseAutomated, parseManual } from "../src/lib/api.js";
import {
  attemptId,
  badgeForKind,
  createAttempt,
  finishAttempt,
  lastResultFromMapped,
  settleInterruptedSession,
  statusFromKind,
  upsertAttempt,
} from "../src/lib/attempts.js";
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
import { chooseResumeId, normalizeResumeList, resumeListError } from "../src/lib/resumes.js";
import { isSameJobUrl, validateJobUrl } from "../src/lib/urls.js";

const STORAGE_KEY = "copilot";
const TOKEN_LOCAL_KEYS = ["accessToken", "expiresAt"];

export default defineBackground(() => {
  let parseInFlight = false;
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
    if (!text) {
      return;
    }
    await browser.action.setBadgeBackgroundColor({ color: color || "#2B7FFF" });
    if (browser.action.setBadgeTextColor) {
      await browser.action.setBadgeTextColor({ color: "#FFFFFF" });
    }
  }

  async function applyBadge(result) {
    const badge = badgeForKind(result?.kind);
    await setBadge(badge.text, badge.color);
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

  async function notifyFor(result) {
    switch (result?.kind) {
      case "in_flight":
      case "idle":
      case "need_connect":
        return;
      case "job": {
        const title = truncate(result.record?.title || "Job saved", 48) || "Job saved";
        const company = truncate(result.record?.company || "", 48);
        await notify("copilot-ok", title, company ? `${company}\n${COPY.JOB_SAVED}` : COPY.JOB_SAVED);
        return;
      }
      case "draft":
        await notify(
          "copilot-draft",
          "Saved as a draft",
          result.failureReason || result.message || COPY.DRAFT_STORED,
        );
        return;
      case "already_saved":
        await notify(
          "copilot-409",
          "Copilot Job Capture",
          result.message || "This post was already added to your records.",
        );
        return;
      case "rate_limited":
        await notify("copilot-429", "Copilot Job Capture", result.message || COPY.RATE_LIMIT);
        return;
      default:
        await notify("copilot-err", "Copilot Job Capture", result.message || COPY.GENERIC_500);
    }
  }

  async function publish(store, result, { notify = true } = {}) {
    await applyBadge(result);
    if (notify) {
      await notifyFor(result);
    }
    const state = toSafeState(store);
    await broadcast(state);
    return state;
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
    store.resumes = [];
    store.selectedResumeId = null;
    store.resumesLoaded = false;
    store.resumesError = null;
    if (store.lastResult?.kind === "need_connect") {
      store.lastResult = idleResult();
    }
    await writeStore(store);
    const loaded = await loadResumeList(store, { force: true });
    await applyBadge(loaded.lastResult);
    const state = toSafeState(loaded);
    await broadcast(state);
    return { ok: true };
  }

  function selectionReady(store) {
    if (!store?.resumesLoaded) {
      return false;
    }
    if (store.selectedResumeId == null) {
      return true;
    }
    return (store.resumes || []).some((item) => item.id === store.selectedResumeId);
  }

  function clearedResumes(message) {
    return {
      resumes: [],
      selectedResumeId: null,
      resumesLoaded: false,
      resumesError: message || null,
    };
  }

  async function loadResumeList(store, { force = false } = {}) {
    if (!force && selectionReady(store)) {
      return store;
    }
    const connection = connectionFromSession(store);
    if (connection !== "connected") {
      return patchStore(
        clearedResumes(connection === "expired" ? COPY.EXPIRED : COPY.CONNECT_PROMPT),
      );
    }

    let raw;
    try {
      raw = await listResumes(getApiBaseUrl(), store.accessToken);
    } catch {
      raw = { errorKind: "network", httpStatus: null, message: null, data: null, success: false };
    }

    if (raw.httpStatus === 401) {
      return patchStore({
        accessToken: null,
        expiresAt: null,
        ...clearedResumes(COPY.UNAUTHORIZED),
      });
    }

    const message = resumeListError(raw);
    if (message) {
      const prior = Array.isArray(store.resumes) ? store.resumes : [];
      return patchStore({
        resumes: prior,
        selectedResumeId: chooseResumeId(prior, store.selectedResumeId),
        resumesLoaded: true,
        resumesError: message,
      });
    }

    const resumes = normalizeResumeList(raw.data);
    return patchStore({
      resumes,
      selectedResumeId: chooseResumeId(resumes, store.selectedResumeId),
      resumesLoaded: true,
      resumesError: null,
    });
  }

  function tabPatch(request) {
    if (request.captureTabId == null) {
      return {};
    }
    return { lastTabId: request.captureTabId };
  }

  async function recordTerminal(store, mapped, request, extraPatch = {}, { notify = true } = {}) {
    const id = attemptId();
    const attempt = createAttempt({
      id,
      sourceUrl: request.sourceUrl || "",
      origin: request.origin,
      mode: request.parseKind === "manual" ? "manual" : "automated",
      status: statusFromKind(mapped.kind),
      message: mapped.message,
      httpStatus: mapped.httpStatus ?? null,
    });
    const lastResult = lastResultFromMapped(mapped, id, false);
    const next = await patchStore({
      lastResult,
      attempts: upsertAttempt(store.attempts, attempt),
      ...tabPatch(request),
      ...extraPatch,
    });
    return publish(next, lastResult, { notify });
  }

  async function runParse(request) {
    const { parseKind, sourceUrl, rawJobText, captureTabUrl } = request;
    if (parseInFlight) {
      await applyBadge({ kind: "in_flight" });
      return toSafeState(await readStore());
    }

    let store = await readStore();
    if (store.retryAfterEpochMs && Date.now() < store.retryAfterEpochMs) {
      return toSafeState(store);
    }

    const connection = connectionFromSession(store);
    if (connection !== "connected") {
      return recordTerminal(
        store,
        {
          kind: "need_connect",
          httpStatus: null,
          message: connection === "expired" ? COPY.EXPIRED : COPY.CONNECT_PROMPT,
          offerFallback: false,
          persistedAs: null,
          jobId: null,
          draftId: null,
          failureCategory: null,
          failureReason: null,
          record: null,
        },
        request,
        {},
        { notify: false },
      );
    }

    store = await loadResumeList(store);
    if (connectionFromSession(store) !== "connected") {
      return recordTerminal(
        store,
        {
          kind: "need_connect",
          httpStatus: 401,
          message: COPY.UNAUTHORIZED,
          offerFallback: false,
          persistedAs: null,
          jobId: null,
          draftId: null,
          failureCategory: null,
          failureReason: null,
          record: null,
        },
        request,
        clearedResumes(COPY.UNAUTHORIZED),
        { notify: false },
      );
    }

    const prepared =
      parseKind === "manual"
        ? prepareManualPayload({ sourceUrl, rawJobText })
        : prepareAutomatedPayload({ sourceUrl });
    if (!prepared.ok) {
      return recordTerminal(
        store,
        {
          kind: "error",
          httpStatus: null,
          message: prepared.message,
          offerFallback: false,
          persistedAs: null,
          jobId: null,
          draftId: null,
          failureCategory: null,
          failureReason: null,
          record: null,
        },
        { ...request, sourceUrl: sourceUrl || "" },
        {},
        { notify: request.origin !== "link" },
      );
    }

    const id = attemptId();
    const pending = createAttempt({
      id,
      sourceUrl: prepared.url,
      origin: request.origin,
      mode: parseKind === "manual" ? "manual" : "automated",
      status: "pending",
      message: COPY.EXTRACTING_LONG,
    });
    const inflightResult = lastResultFromMapped(
      {
        kind: "in_flight",
        httpStatus: null,
        message: COPY.EXTRACTING_LONG,
        record: null,
      },
      id,
      false,
    );

    parseInFlight = true;
    try {
      store = await patchStore({
        inFlight: true,
        lastResult: inflightResult,
        attempts: upsertAttempt(store.attempts, pending),
        lastParseSourceUrl: prepared.url,
        ...tabPatch(request),
      });
      await applyBadge(inflightResult);
      await broadcast(toSafeState(store));

      const apiBase = getApiBaseUrl();
      const resumeId = store.selectedResumeId;
      let raw;
      try {
        if (parseKind === "manual") {
          raw = await parseManual(apiBase, store.accessToken, {
            sourceUrl: prepared.url,
            rawJobText: prepared.rawJobText,
            resumeId,
          });
        } else {
          raw = await parseAutomated(apiBase, store.accessToken, prepared.url, { resumeId });
        }
      } catch {
        raw = {
          errorKind: "network",
          httpStatus: null,
          message: null,
          data: null,
          retryAfterMs: null,
          success: false,
        };
      }

      const mapped = mapParseOutcome({
        parseKind,
        httpStatus: raw.httpStatus,
        message: raw.message,
        data: raw.data,
        errorKind: raw.errorKind,
        success: raw.success,
      });
      const offerFallback = Boolean(mapped.offerFallback) && isSameJobUrl(prepared.url, captureTabUrl || "");
      const finished = finishAttempt(pending, mapped, offerFallback);
      const lastResult = lastResultFromMapped(mapped, id, offerFallback);
      const tokenPatch = mapped.shouldClearSession
        ? { accessToken: null, expiresAt: null, ...clearedResumes(COPY.UNAUTHORIZED) }
        : {};
      const retryAfterEpochMs =
        mapped.kind === "rate_limited" ? Date.now() + (raw.retryAfterMs || 60_000) : null;

      store = await patchStore({
        inFlight: false,
        lastResult,
        attempts: upsertAttempt(store.attempts, finished),
        retryAfterEpochMs,
        ...tokenPatch,
      });
      return publish(store, lastResult);
    } finally {
      parseInFlight = false;
    }
  }

  async function confirmFallback() {
    const store = await readStore();
    if (!store.lastResult?.offerFallback || parseInFlight) {
      return toSafeState(store);
    }

    const originalMessage = store.lastResult.message || "";
    const urlCheck = validateJobUrl(store.lastParseSourceUrl || store.lastTabUrl);
    const request = {
      parseKind: "manual",
      origin: "fallback",
      sourceUrl: store.lastParseSourceUrl || store.lastTabUrl || "",
      captureTabId: store.lastTabId,
      captureTabUrl: store.lastTabUrl || "",
    };
    if (!urlCheck.ok || store.lastTabId == null) {
      return recordTerminal(
        store,
        {
          kind: "error",
          httpStatus: store.lastResult.httpStatus,
          message: `${originalMessage}\n\n${COPY.FALLBACK_EMPTY}`,
          record: null,
        },
        request,
        { capturedText: "" },
      );
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
      return recordTerminal(
        store,
        {
          kind: "error",
          httpStatus: store.lastResult.httpStatus,
          message: `${originalMessage}\n\n${COPY.FALLBACK_EMPTY}`,
          record: null,
        },
        request,
        { capturedText: "" },
      );
    }

    await patchStore({ capturedText: text });
    return runParse({
      ...request,
      sourceUrl: urlCheck.url,
      rawJobText: text,
    });
  }

  function savedInputs(message) {
    const patch = {};
    if (message.manualDraft && typeof message.manualDraft === "object") {
      patch.manualDraft = {
        sourceUrl: String(message.manualDraft.sourceUrl || "").slice(0, 2000),
        rawJobText: clipRawJobText(String(message.manualDraft.rawJobText || "")),
      };
      patch.manualTouched = true;
    }
    if (typeof message.customUrl === "string") {
      patch.customUrl = message.customUrl.slice(0, 2000);
      patch.customTouched = true;
    }
    return patch;
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
        let next = await patchStore(patch);
        if (connectionFromSession(next) === "connected") {
          next = await loadResumeList(next, { force: true });
        }
        await applyBadge(next.lastResult);
        return toSafeState(next);
      }
      case MSG.COPILOT_CONNECT:
        await openConnectTab();
        return toSafeState(await readStore());
      case MSG.COPILOT_DISCONNECT: {
        const store = await readStore();
        store.accessToken = null;
        store.expiresAt = null;
        Object.assign(store, clearedResumes(null));
        await writeStore(store);
        const state = toSafeState(store);
        await broadcast(state);
        return state;
      }
      case MSG.COPILOT_SAVE_INPUTS: {
        const next = await patchStore(savedInputs(message));
        return toSafeState(next);
      }
      case MSG.COPILOT_LOAD_RESUMES: {
        const store = await readStore();
        const next = await loadResumeList(store, { force: true });
        const state = toSafeState(next);
        await broadcast(state);
        return state;
      }
      case MSG.COPILOT_SELECT_RESUME: {
        const store = await readStore();
        const resumeId = message.resumeId;
        const known = (store.resumes || []).some((item) => item.id === resumeId);
        if (!known) {
          return toSafeState(store);
        }
        const next = await patchStore({ selectedResumeId: resumeId, resumesError: null });
        const state = toSafeState(next);
        await broadcast(state);
        return state;
      }
      case MSG.COPILOT_PARSE_AUTOMATED: {
        const request = {
          parseKind: "automated",
          sourceUrl: message.sourceUrl,
          origin: message.origin === "link" ? "link" : "tab",
          captureTabId: Number.isInteger(message.captureTabId) ? message.captureTabId : null,
          captureTabUrl: typeof message.captureTabUrl === "string" ? message.captureTabUrl : "",
        };
        if (message.detach) {
          runParse(request).catch(() => {});
          return { ok: true };
        }
        return runParse(request);
      }
      case MSG.COPILOT_PARSE_MANUAL:
        return runParse({
          parseKind: "manual",
          sourceUrl: message.sourceUrl,
          rawJobText: message.rawJobText,
          origin: "manual",
          captureTabId: Number.isInteger(message.captureTabId) ? message.captureTabId : null,
          captureTabUrl: typeof message.captureTabUrl === "string" ? message.captureTabUrl : "",
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

  const initPromise = (async () => {
    try {
      const store = await readStore();
      const settled = settleInterruptedSession(store, COPY.INTERRUPTED);
      const next = await patchStore(settled);
      await applyBadge(next.lastResult);
    } catch {
      // The worker can still accept the next submission.
    }
  })();

  browser.commands.onCommand.addListener((command) => {
    if (command === "open-copilot-panel" && browser.action.openPopup) {
      browser.action.openPopup().catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    initPromise
      .then(() => handleInternal(message, sender))
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "Something went wrong." }));
    return true;
  });

  browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MSG.COPILOT_EXTENSION_TOKEN) {
      return undefined;
    }
    initPromise
      .then(() => acceptTokenMessage(message, originFromSender(sender)))
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "Something went wrong." }));
    return true;
  });
});
