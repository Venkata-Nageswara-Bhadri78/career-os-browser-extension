import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { AutomatedExtraction, ManualExtraction } from "../../src/components/ExtractionForms.jsx";
import { CloseIcon, PaperPlaneIcon } from "../../src/components/Icons.jsx";
import { ResultPanel } from "../../src/components/ResultPanel.jsx";
import { COPY } from "../../src/lib/errors.js";
import { MSG } from "../../src/lib/messages.js";

const NAV = [
  { id: "manual", label: "1. Manual Extraction" },
  { id: "automated", label: "2. Automated Extraction" },
  { id: "result", label: "3. Result" },
];

function defaultSection(state) {
  if (!state) {
    return "automated";
  }
  if (state.inFlight) {
    return "result";
  }
  const kind = state.lastResult?.kind;
  if (kind === "success" || kind === "already_saved" || kind === "in_flight" || kind === "offer_fallback") {
    return "result";
  }
  return "automated";
}

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
  const [section, setSection] = useState("automated");
  const [manualUrl, setManualUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [autoUrl, setAutoUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const booted = useRef(false);
  const manualPrefill = useRef(false);
  const autoPrefill = useRef(false);

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
    if (!state || booted.current) {
      return;
    }
    booted.current = true;
    setSection(defaultSection(state));
  }, [state]);

  useEffect(() => {
    if (!state?.lastTabUrl) {
      return;
    }
    if (!manualPrefill.current && !manualUrl) {
      setManualUrl(state.lastTabUrl);
      manualPrefill.current = true;
    }
    if (!autoPrefill.current && !autoUrl) {
      setAutoUrl(state.lastTabUrl);
      autoPrefill.current = true;
    }
  }, [state?.lastTabUrl, autoUrl, manualUrl]);

  const rateLimited = Boolean(state?.retryAfterEpochMs && now < state.retryAfterEpochMs);
  const busy = Boolean(state?.inFlight);
  const sendDisabled = busy || rateLimited;

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

  function sendParse(type, payload) {
    setSection("result");
    return send(type, payload);
  }

  async function connectAndClose() {
    try {
      await browser.runtime.sendMessage({ type: MSG.COPILOT_CONNECT });
    } finally {
      window.close();
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-page text-ink">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
          <PaperPlaneIcon className="h-3.5 w-3.5" />
        </span>
        <h1 className="flex-1 truncate text-sm font-semibold">Copilot Job Capture</h1>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chipClass(state?.connection)}`}>
          {connectionLabel(state?.connection)}
        </span>
        {state?.connection === "connected" ? (
          <button
            type="button"
            className="text-xs font-medium text-muted hover:text-ink"
            onClick={() => send(MSG.COPILOT_DISCONNECT)}
          >
            {COPY.DISCONNECT}
          </button>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:underline"
            onClick={() => connectAndClose()}
          >
            Connect
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          className="rounded-md p-1 text-muted hover:bg-page hover:text-ink"
          onClick={() => window.close()}
        >
          <CloseIcon />
        </button>
      </header>

      {state?.connection === "expired" ? (
        <p className="border-b border-line bg-red-50 px-3 py-1.5 text-xs text-danger">{COPY.EXPIRED}</p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-line bg-surface">
          <nav className="flex-1 p-2">
            {NAV.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                    active ? "bg-sidebar-active font-medium text-ink" : "text-muted hover:bg-page"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-line p-3">
            <p className={`text-xs font-medium ${chipClass(state?.connection)} inline-block rounded-full px-2 py-0.5`}>
              {connectionLabel(state?.connection)}
            </p>
            <div className="mt-2">
              {state?.connection === "connected" ? (
                <button
                  type="button"
                  className="text-xs font-medium text-muted hover:text-ink"
                  onClick={() => send(MSG.COPILOT_DISCONNECT)}
                >
                  {COPY.DISCONNECT}
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={() => connectAndClose()}
                >
                  {COPY.CONNECT_LABEL}
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted">{COPY.CONNECT_SUBTEXT}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-page p-4">
          <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
            {section === "manual" ? (
              <ManualExtraction
                url={manualUrl}
                text={manualText}
                onUrlChange={setManualUrl}
                onTextChange={setManualText}
                hasCapturedText={Boolean(state?.capturedText)}
                onUseCaptured={() => setManualText(state.capturedText || "")}
                sendDisabled={sendDisabled}
                busy={busy}
                onSend={() =>
                  sendParse(MSG.COPILOT_PARSE_MANUAL, { sourceUrl: manualUrl, rawJobText: manualText })
                }
              />
            ) : null}
            {section === "automated" ? (
              <AutomatedExtraction
                url={autoUrl}
                onUrlChange={setAutoUrl}
                sendDisabled={sendDisabled}
                busy={busy}
                onSend={() => sendParse(MSG.COPILOT_PARSE_AUTOMATED, { sourceUrl: autoUrl })}
              />
            ) : null}
            {section === "result" ? (
              <ResultPanel
                state={state}
                now={now}
                sendDisabled={sendDisabled}
                onConnect={() => connectAndClose()}
                onConfirmFallback={() => sendParse(MSG.COPILOT_CONFIRM_FALLBACK)}
                onOpenWebsite={() => browser.runtime.sendMessage({ type: MSG.COPILOT_OPEN_WEBSITE })}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
