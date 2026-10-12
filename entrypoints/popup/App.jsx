import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { ManualExtraction } from "../../src/components/ExtractionForms.jsx";
import { ChevronLeftIcon, CloseIcon, PaperPlaneIcon } from "../../src/components/Icons.jsx";
import { CustomUrlBar, Launcher } from "../../src/components/QuickActions.jsx";
import { ResultPanel } from "../../src/components/ResultPanel.jsx";
import { ResumeList } from "../../src/components/ResumeList.jsx";
import { latestStatus } from "../../src/lib/attempts.js";
import { COPY } from "../../src/lib/errors.js";
import { MSG } from "../../src/lib/messages.js";
import { prepareAutomatedPayload } from "../../src/lib/payload.js";

const NAV = [
  { id: "capture", label: "Capture" },
  { id: "results", label: "Results" },
  { id: "resumes", label: "Resumes" },
];

function connectionLabel(connection) {
  if (connection === "connected") {
    return "Connected";
  }
  if (connection === "expired") {
    return "Expired";
  }
  return "Disconnected";
}

function chipClass(connection) {
  if (connection === "connected") {
    return "bg-emerald-50 text-success";
  }
  if (connection === "expired") {
    return "bg-red-50 text-danger";
  }
  return "bg-gray-100 text-muted";
}

export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("launcher");
  const [section, setSection] = useState("capture");
  const [manualUrl, setManualUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [pendingLocal, setPendingLocal] = useState(false);
  const [resumesLoading, setResumesLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [inputsReady, setInputsReady] = useState(false);
  const restored = useRef(false);
  const edited = useRef({ manual: false, custom: false });
  const submitLock = useRef(false);
  const draftRef = useRef({ manualUrl: "", manualText: "", customUrl: "" });

  draftRef.current = { manualUrl, manualText, customUrl };

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("copilot-expanded", view === "expanded");
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      let tabId = null;
      let tabUrl = "";
      try {
        const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        tabId = tabs[0]?.id ?? null;
        tabUrl = tabs[0]?.url || "";
      } catch {
        // activeTab may not expose chrome:// URLs
      }
      const next = await browser.runtime.sendMessage({
        type: MSG.COPILOT_POPUP_OPENED,
        tabId,
        tabUrl,
      });
      if (!cancelled && next) {
        setState(next);
      }
    }
    boot();
    const onMessage = (message) => {
      if (message?.type === MSG.COPILOT_STATE && message.state) {
        setState(message.state);
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      cancelled = true;
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  useEffect(() => {
    if (!state || restored.current) {
      return;
    }
    restored.current = true;
    if (!edited.current.manual) {
      if (state.manualTouched && state.manualDraft) {
        setManualUrl(state.manualDraft.sourceUrl || "");
        setManualText(state.manualDraft.rawJobText || "");
      } else if (state.lastTabUrl) {
        setManualUrl(state.lastTabUrl);
      }
    }
    if (!edited.current.custom && state.customTouched && typeof state.customUrl === "string") {
      setCustomUrl(state.customUrl);
    }
    if (state.inFlight) {
      setView("expanded");
      setSection("results");
    }
    setInputsReady(true);
  }, [state]);

  function persistInputs() {
    if (!edited.current.manual && !edited.current.custom) {
      return;
    }
    const current = draftRef.current;
    const payload = { type: MSG.COPILOT_SAVE_INPUTS };
    if (edited.current.manual) {
      payload.manualDraft = { sourceUrl: current.manualUrl, rawJobText: current.manualText };
    }
    if (edited.current.custom) {
      payload.customUrl = current.customUrl;
    }
    browser.runtime.sendMessage(payload).catch(() => {});
  }

  useEffect(() => {
    if (!inputsReady) {
      return undefined;
    }
    const handle = setTimeout(persistInputs, 400);
    return () => clearTimeout(handle);
  }, [inputsReady, manualUrl, manualText, customUrl]);

  useEffect(() => {
    return () => {
      if (!restored.current) {
        return;
      }
      persistInputs();
    };
  }, []);

  const rateLimited = Boolean(state?.retryAfterEpochMs && now < state.retryAfterEpochMs);
  const busy = Boolean(state?.inFlight) || pendingLocal;
  const sendDisabled = busy || rateLimited;
  const waitSeconds = rateLimited ? Math.ceil((state.retryAfterEpochMs - now) / 1000) : 0;

  useEffect(() => {
    if (!rateLimited && !busy) {
      return undefined;
    }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rateLimited, busy]);

  function applyState(next) {
    if (next && next.connection) {
      setState(next);
    }
  }

  function send(type, payload) {
    return browser.runtime.sendMessage({ type, ...payload }).then(applyState);
  }

  async function activeTab() {
    try {
      const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      return { id: tabs[0]?.id ?? null, url: tabs[0]?.url || "" };
    } catch {
      return { id: null, url: state?.lastTabUrl || "" };
    }
  }

  async function withSubmitLock(work) {
    if (submitLock.current || sendDisabled) {
      return;
    }
    submitLock.current = true;
    setPendingLocal(true);
    try {
      await work();
    } finally {
      submitLock.current = false;
      setPendingLocal(false);
    }
  }

  function openResults() {
    setView("expanded");
    setSection("results");
  }

  function openCapture() {
    setView("expanded");
    setSection(busy ? "results" : "capture");
  }

  async function submitCurrentTab() {
    if (submitLock.current || sendDisabled) {
      return;
    }
    submitLock.current = true;
    const tab = await activeTab();
    try {
      await browser.runtime.sendMessage({
        type: MSG.COPILOT_PARSE_AUTOMATED,
        sourceUrl: tab.url || state?.lastTabUrl || "",
        origin: "tab",
        captureTabId: tab.id,
        captureTabUrl: tab.url || state?.lastTabUrl || "",
        detach: true,
      });
    } catch {
      // The worker keeps the submission after the popup closes.
    }
    window.close();
  }

  async function submitCustomUrl(event) {
    event.preventDefault();
    await withSubmitLock(async () => {
      const prepared = prepareAutomatedPayload({ sourceUrl: customUrl });
      const tab = await activeTab();
      if (!prepared.ok) {
        setUrlError(prepared.message);
        await send(MSG.COPILOT_PARSE_AUTOMATED, {
          sourceUrl: customUrl,
          origin: "link",
          captureTabId: tab.id,
          captureTabUrl: tab.url || "",
        });
        return;
      }
      setUrlError("");
      openResults();
      await send(MSG.COPILOT_PARSE_AUTOMATED, {
        sourceUrl: prepared.url,
        origin: "link",
        captureTabId: tab.id,
        captureTabUrl: tab.url || "",
      });
    });
  }

  async function submitManual() {
    await withSubmitLock(async () => {
      const tab = await activeTab();
      setSection("results");
      await send(MSG.COPILOT_PARSE_MANUAL, {
        sourceUrl: manualUrl,
        rawJobText: manualText,
        captureTabId: tab.id,
        captureTabUrl: tab.url || state?.lastTabUrl || "",
      });
    });
  }

  async function connectAndClose() {
    try {
      await browser.runtime.sendMessage({ type: MSG.COPILOT_CONNECT });
    } finally {
      window.close();
    }
  }

  const selectedResume = (state?.resumes || []).find((item) => item.id === state?.selectedResumeId);
  const resumeName = selectedResume?.name || "";

  async function refreshResumes() {
    setResumesLoading(true);
    try {
      await send(MSG.COPILOT_LOAD_RESUMES);
    } finally {
      setResumesLoading(false);
    }
  }

  const sendTitle = rateLimited
    ? `Try again in ${waitSeconds}s`
    : busy
      ? "Submitting"
      : "Send current tab";

  if (view === "launcher") {
    return (
      <Launcher
        sendDisabled={sendDisabled}
        sendTitle={sendTitle}
        dotStatus={latestStatus(state)}
        onSend={submitCurrentTab}
        onLink={() => {
          setUrlError("");
          setView("url");
        }}
        onMore={openCapture}
        onDot={openResults}
      />
    );
  }

  if (view === "url") {
    return (
      <CustomUrlBar
        url={customUrl}
        onUrlChange={(value) => {
          edited.current.custom = true;
          setCustomUrl(value);
          setUrlError("");
        }}
        onSubmit={submitCustomUrl}
        onBack={() => setView("launcher")}
        disabled={sendDisabled}
        error={urlError}
        waitSeconds={waitSeconds}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page text-ink">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5">
        <button
          type="button"
          aria-label="Back"
          title="Back"
          className="rounded-full border border-line p-1 text-accent hover:bg-page"
          onClick={() => setView("launcher")}
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </button>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
          <PaperPlaneIcon className="h-3 w-3" />
        </span>
        <h1 className="flex-1 truncate text-[13px] font-semibold">Copilot Job Capture</h1>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${chipClass(state?.connection)}`}>
          {connectionLabel(state?.connection)}
        </span>
        {state?.connection === "connected" ? (
          <button
            type="button"
            className="text-[11px] font-medium text-muted hover:text-ink"
            onClick={() => send(MSG.COPILOT_DISCONNECT)}
          >
            {COPY.DISCONNECT}
          </button>
        ) : (
          <button
            type="button"
            className="text-[11px] font-semibold text-accent hover:underline"
            onClick={() => connectAndClose()}
          >
            Connect
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          className="rounded-full p-1 text-muted hover:bg-page hover:text-ink"
          onClick={() => window.close()}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      {state?.connection === "expired" ? (
        <p className="border-b border-line bg-red-50 px-3 py-1 text-[11px] text-danger">{COPY.EXPIRED}</p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[168px] shrink-0 flex-col border-r border-line bg-surface">
          <nav className="flex-1 p-1.5">
            {NAV.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`mb-0.5 w-full rounded-full px-3 py-1.5 text-left text-[13px] ${
                    active ? "bg-sidebar-active font-medium text-ink" : "text-muted hover:bg-page"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-line p-2.5">
            <p className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${chipClass(state?.connection)}`}>
              {connectionLabel(state?.connection)}
            </p>
            <div className="mt-1.5">
              {state?.connection === "connected" ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-muted hover:text-ink"
                  onClick={() => send(MSG.COPILOT_DISCONNECT)}
                >
                  {COPY.DISCONNECT}
                </button>
              ) : (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-accent hover:underline"
                  onClick={() => connectAndClose()}
                >
                  {COPY.CONNECT_LABEL}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted">{COPY.CONNECT_SUBTEXT}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-page p-3">
          <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
            {section === "capture" ? (
              <ManualExtraction
                url={manualUrl}
                text={manualText}
                onUrlChange={(value) => {
                  edited.current.manual = true;
                  setManualUrl(value);
                }}
                onTextChange={(value) => {
                  edited.current.manual = true;
                  setManualText(value);
                }}
                hasCapturedText={Boolean(state?.capturedText)}
                onUseCaptured={() => {
                  edited.current.manual = true;
                  setManualText(state.capturedText || "");
                }}
                resumeName={resumeName}
                sendDisabled={sendDisabled}
                busy={busy}
                onSend={submitManual}
              />
            ) : null}
            {section === "resumes" ? (
              <ResumeList
                connection={state?.connection}
                resumes={state?.resumes}
                selectedResumeId={state?.selectedResumeId}
                loaded={Boolean(state?.resumesLoaded)}
                error={state?.resumesError}
                loading={resumesLoading}
                onSelect={(resumeId) => send(MSG.COPILOT_SELECT_RESUME, { resumeId })}
                onRefresh={refreshResumes}
                onConnect={() => connectAndClose()}
              />
            ) : null}
            {section === "results" ? (
              <ResultPanel
                state={state}
                now={now}
                forceExtracting={pendingLocal}
                sendDisabled={sendDisabled}
                onConnect={() => connectAndClose()}
                onConfirmFallback={() => {
                  if (submitLock.current || sendDisabled) {
                    return;
                  }
                  submitLock.current = true;
                  setPendingLocal(true);
                  send(MSG.COPILOT_CONFIRM_FALLBACK).finally(() => {
                    submitLock.current = false;
                    setPendingLocal(false);
                  });
                }}
                onOpenWebsite={() => browser.runtime.sendMessage({ type: MSG.COPILOT_OPEN_WEBSITE })}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
