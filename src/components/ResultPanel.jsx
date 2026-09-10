import { COPY } from "../lib/errors.js";
import { SectionHeading } from "./ExtractionForms.jsx";

function Spinner() {
  return (
    <div
      className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
      aria-hidden="true"
    />
  );
}

function Field({ label, value }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

export function ResultPanel({
  state,
  now,
  onConnect,
  onConfirmFallback,
  onOpenWebsite,
  sendDisabled,
}) {
  const result = state?.lastResult || { kind: "idle" };
  const remainingMs = (state?.retryAfterEpochMs || 0) - now;
  const waitSeconds = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  const extracting = result.kind === "in_flight" || Boolean(state?.inFlight);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SectionHeading number="3" title="Result" />
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {extracting ? (
          <div className="flex items-center gap-3 text-sm text-ink">
            <Spinner />
            <span>{COPY.EXTRACTING_LONG}</span>
          </div>
        ) : null}

        {!extracting && result.kind === "idle" ? <p className="text-sm text-muted">{COPY.IDLE}</p> : null}

        {result.kind === "success" ? (
          <SuccessView preview={result.preview} message={result.message} onOpenWebsite={onOpenWebsite} />
        ) : null}

        {result.kind === "already_saved" ? (
          <StatusCard tone="info" message={result.message} />
        ) : null}

        {result.kind === "error" ? <StatusCard tone="danger" message={result.message} /> : null}

        {result.kind === "need_connect" ? (
          <div className="space-y-3">
            <StatusCard tone="danger" message={result.message || COPY.CONNECT_PROMPT} />
            <p className="text-xs text-muted">{COPY.CONNECT_SUBTEXT}</p>
            <button
              type="button"
              onClick={onConnect}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              {COPY.CONNECT_LABEL}
            </button>
          </div>
        ) : null}

        {result.kind === "rate_limited" ? (
          <div className="space-y-2">
            <StatusCard tone="info" message={result.message || COPY.RATE_LIMIT} />
            {waitSeconds > 0 ? (
              <p className="text-sm text-muted">Try again in {waitSeconds}s.</p>
            ) : null}
          </div>
        ) : null}

        {result.kind === "offer_fallback" ? (
          <div className="space-y-3">
            <StatusCard tone="danger" message={result.message} />
            <p className="text-sm text-ink">{COPY.FALLBACK_CTA}</p>
            <button
              type="button"
              disabled={sendDisabled}
              onClick={onConfirmFallback}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Capture page text and retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusCard({ tone, message }) {
  const cls =
    tone === "danger"
      ? "border-danger/20 bg-red-50 text-danger"
      : "border-accent/20 bg-sidebar-active text-ink";
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${cls}`}>{message}</div>
  );
}

function SuccessView({ preview, message, onOpenWebsite }) {
  const skills = preview?.skills?.length ? preview.skills.join(", ") : "";
  return (
    <div className="space-y-3">
      <StatusCard tone="info" message={message} />
      {preview?.requiresManualReview ? (
        <p className="text-sm text-ink">
          Title or company may need editing on the website. This is still a successful preview.
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-white p-3">
        <Field label="Title" value={preview?.title} />
        <Field label="Company" value={preview?.company} />
        <Field label="Location" value={preview?.location} />
        <Field label="Canonical URL" value={preview?.sourceUrl} />
        <Field label="Skills" value={skills} />
      </dl>
      <details className="rounded-xl border border-line bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-ink">More</summary>
        <dl className="mt-3 grid grid-cols-1 gap-3">
          <Field label="Employment type" value={preview?.employmentType} />
          <Field label="Work mode" value={preview?.workMode} />
          <Field label="Experience" value={preview?.experience} />
          <Field label="Salary" value={preview?.salary} />
          <Field label="Education" value={preview?.education} />
          <Field label="Department" value={preview?.department} />
          <Field label="Industry" value={preview?.industry} />
          <Field label="Source platform" value={preview?.sourcePlatform} />
          <Field label="Description" value={preview?.description} />
        </dl>
      </details>
      <p className="text-xs text-muted">{COPY.SUCCESS_FOOTER}</p>
      <button
        type="button"
        onClick={onOpenWebsite}
        className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
      >
        Open Copilot
      </button>
    </div>
  );
}
