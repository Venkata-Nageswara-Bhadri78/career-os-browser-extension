import { useEffect, useRef } from "react";
import { dotLabel } from "../lib/attempts.js";
import { ChevronLeftIcon, EllipsisIcon, LinkIcon, PaperPlaneIcon } from "./Icons.jsx";

function RoundButton({ label, onClick, disabled, children, filled = false }) {
  return (
    <button
      type={filled ? "submit" : "button"}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-accent transition disabled:cursor-not-allowed disabled:opacity-50 ${
        filled
          ? "border-accent bg-accent text-white shadow-sm hover:bg-accent-hover"
          : "border-line bg-white hover:bg-page"
      }`}
    >
      {children}
    </button>
  );
}

function statusDotClass(status) {
  switch (status) {
    case "job":
      return "bg-success";
    case "draft":
      return "bg-draft";
    case "pending":
      return "animate-pulse bg-muted";
    case "already_saved":
    case "rate_limited":
      return "bg-accent";
    default:
      return "bg-danger";
  }
}

export function Launcher({ sendDisabled, sendTitle, dotStatus, onSend, onLink, onMore, onDot }) {
  const label = dotLabel(dotStatus);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-line p-1.5 shadow-[0_8px_24px_rgba(31,41,55,0.08)]">
      <RoundButton label={sendTitle || "Send current tab"} onClick={onSend} disabled={sendDisabled} filled>
        <PaperPlaneIcon className="h-3.5 w-3.5" />
      </RoundButton>
      <RoundButton label="Enter a job URL" onClick={onLink}>
        <LinkIcon className="h-3.5 w-3.5" />
      </RoundButton>
      <RoundButton label="Open capture and results" onClick={onMore}>
        <EllipsisIcon className="h-3.5 w-3.5" />
      </RoundButton>
      {dotStatus && dotStatus !== "idle" ? (
        <button
          type="button"
          aria-label={label || "Submission status"}
          title={label}
          onClick={onDot}
          className="flex h-8 w-5 shrink-0 items-center justify-center"
        >
          <span className={`h-2 w-2 rounded-full ${statusDotClass(dotStatus)}`} />
        </button>
      ) : null}
    </div>
  );
}

export function CustomUrlBar({ url, onUrlChange, onSubmit, onBack, disabled, error, waitSeconds }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-[380px] rounded-[22px] border border-line bg-white p-2.5 shadow-[0_8px_24px_rgba(31,41,55,0.08)]">
      <form onSubmit={onSubmit} className="flex items-center gap-1.5">
        <RoundButton label="Back" onClick={onBack}>
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </RoundButton>
        <div
          className={`flex min-w-0 flex-1 items-center rounded-full border bg-page py-0.5 pl-3.5 pr-0.5 ${
            error ? "border-danger" : "border-line"
          }`}
        >
          <input
            ref={inputRef}
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            maxLength={2000}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a job URL"
            aria-label="Job URL"
            aria-invalid={error ? "true" : "false"}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
          <RoundButton label={disabled ? "Submitting" : "Send job URL"} disabled={disabled} filled>
            <PaperPlaneIcon className="h-3.5 w-3.5" />
          </RoundButton>
        </div>
      </form>
      {error ? <p className="mt-1.5 px-10 text-[11px] break-words text-danger">{error}</p> : null}
      {!error && waitSeconds > 0 ? (
        <p className="mt-1.5 px-10 text-[11px] text-muted">Try again in {waitSeconds}s.</p>
      ) : null}
      {!error && waitSeconds <= 0 ? (
        <p className="mt-1.5 px-10 text-[11px] text-muted">Paste a LinkedIn, Naukri, or other job link.</p>
      ) : null}
    </div>
  );
}
