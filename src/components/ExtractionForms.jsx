import { COPY } from "../lib/errors.js";
import { MAX_RAW_JOB_TEXT } from "../lib/payload.js";
import { SendButton } from "./SendButton.jsx";

export function ManualExtraction({
  url,
  text,
  onUrlChange,
  onTextChange,
  onSend,
  onUseCaptured,
  hasCapturedText,
  sendDisabled,
  busy,
}) {
  const remaining = Math.max(0, MAX_RAW_JOB_TEXT - (text?.length || 0));
  return (
    <div className="flex h-full flex-col">
      <SectionHeading number="1" title="Manual Extraction" />
      <label className="mt-4 text-sm font-medium text-ink">URL</label>
      <input
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        maxLength={2000}
        placeholder="Enter or paste the job URL"
        className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none ring-accent placeholder:text-muted focus:ring-2"
      />
      <div className="mt-4 flex items-center justify-between">
        <label className="text-sm font-medium text-ink">Job posting text</label>
        {hasCapturedText ? (
          <button
            type="button"
            className="text-xs font-medium text-accent hover:underline"
            onClick={onUseCaptured}
          >
            Use captured text
          </button>
        ) : null}
      </div>
      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        maxLength={MAX_RAW_JOB_TEXT}
        placeholder="Paste the full job posting (Ctrl+A, Ctrl+C, Ctrl+V)."
        className="mt-1.5 min-h-0 flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-accent placeholder:text-muted focus:ring-2"
      />
      <p className="mt-1.5 text-xs text-muted">{remaining.toLocaleString()} characters remaining</p>
      <div className="mt-3">
        <SendButton disabled={sendDisabled} busy={busy} onClick={onSend} />
      </div>
      {busy ? <p className="mt-2 text-xs text-muted">{COPY.BUSY}</p> : null}
    </div>
  );
}

export function AutomatedExtraction({ url, onUrlChange, onSend, sendDisabled, busy }) {
  return (
    <div className="flex h-full flex-col">
      <SectionHeading number="2" title="Automated Extraction" />
      <label className="mt-4 text-sm font-medium text-ink">URL</label>
      <input
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        maxLength={2000}
        placeholder="Enter or paste the job URL"
        className="mt-1.5 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none ring-accent placeholder:text-muted focus:ring-2"
      />
      <p className="mt-2 text-xs text-muted">
        Uses the current tab URL by default. Paste the real job URL for in-page viewers (LinkedIn, Indeed).
      </p>
      <div className="mt-auto pt-6">
        <SendButton disabled={sendDisabled} busy={busy} onClick={onSend} />
      </div>
      {busy ? <p className="mt-2 text-xs text-muted">{COPY.BUSY}</p> : null}
    </div>
  );
}

export function SectionHeading({ number, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
        {number}
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
    </div>
  );
}
