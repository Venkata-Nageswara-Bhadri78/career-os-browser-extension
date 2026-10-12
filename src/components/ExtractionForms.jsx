import { COPY } from "../lib/errors.js";
import { MAX_RAW_JOB_TEXT } from "../lib/payload.js";
import { PaperPlaneIcon } from "./Icons.jsx";
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
  resumeName,
}) {
  const remaining = Math.max(0, MAX_RAW_JOB_TEXT - (text?.length || 0));
  return (
    <div className="flex h-full flex-col">
      <SectionHeading title="Capture" icon={<PaperPlaneIcon className="h-3.5 w-3.5" />} />
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        Starts with the current tab URL. Copilot saves the job, or stores a draft if it cannot.
      </p>
      <p className="mt-1 text-[11px] text-muted">
        {resumeName
          ? `Sending with ${resumeName}. Change it under Resumes.`
          : "Sending with your priority resume. Change it under Resumes."}
      </p>
      <label className="mt-3 text-[13px] font-medium text-ink" htmlFor="capture-url">
        URL
      </label>
      <input
        id="capture-url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        maxLength={2000}
        placeholder="Enter or paste the job URL"
        className="mt-1 h-9 w-full rounded-full border border-line bg-white px-3.5 text-[13px] text-ink outline-none ring-accent placeholder:text-muted focus:ring-2"
      />
      <div className="mt-3 flex items-center justify-between">
        <label className="text-[13px] font-medium text-ink" htmlFor="capture-text">
          Job posting text
        </label>
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
        id="capture-text"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        maxLength={MAX_RAW_JOB_TEXT}
        placeholder="Paste the full job posting (Ctrl+A, Ctrl+C, Ctrl+V)."
        className="mt-1 min-h-0 flex-1 resize-none rounded-2xl border border-line bg-white px-3.5 py-2 text-[13px] text-ink outline-none ring-accent placeholder:text-muted focus:ring-2"
      />
      <p className="mt-1 text-[11px] text-muted">{remaining.toLocaleString()} characters remaining</p>
      <div className="mt-2.5">
        <SendButton disabled={sendDisabled} busy={busy} onClick={onSend} />
      </div>
      {busy ? <p className="mt-2 text-xs text-muted">{COPY.BUSY}</p> : null}
    </div>
  );
}

export function SectionHeading({ title, icon = null }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">{icon}</span>
      ) : null}
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
    </div>
  );
}
