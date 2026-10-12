import {
  attemptStatusLabel,
  dotLabel,
  originLabel,
} from "../lib/attempts.js";
import { COPY, failureCategoryHint } from "../lib/errors.js";
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
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{value}</dd>
    </div>
  );
}

function dotClass(status) {
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

function StatusCard({ tone, message }) {
  const toneClass =
    tone === "danger"
      ? "border-danger/20 bg-red-50 text-danger"
      : tone === "draft"
        ? "border-draft bg-draft-soft text-ink"
        : tone === "success"
          ? "border-success/20 bg-emerald-50 text-ink"
          : "border-accent/20 bg-sidebar-active text-ink";
  const dot =
    tone === "danger" ? "bg-danger" : tone === "draft" ? "bg-draft" : tone === "success" ? "bg-success" : "bg-accent";
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2 text-[13px] ${toneClass}`}>
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <p className="whitespace-pre-wrap break-words">{message}</p>
    </div>
  );
}

function formatTime(createdAt) {
  if (!createdAt) {
    return "";
  }
  try {
    return new Date(createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function attemptTitle(attempt) {
  if (attempt.title && attempt.company) {
    return `${attempt.title} · ${attempt.company}`;
  }
  return attempt.title || attempt.company || attempt.sourceUrl || "Job submission";
}

export function ResultPanel({
  state,
  now,
  onConnect,
  onConfirmFallback,
  onOpenWebsite,
  sendDisabled,
  forceExtracting = false,
}) {
  const result = state?.lastResult || { kind: "idle" };
  const attempts = Array.isArray(state?.attempts) ? state.attempts : [];
  const remainingMs = (state?.retryAfterEpochMs || 0) - now;
  const waitSeconds = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  const extracting = forceExtracting || result.kind === "in_flight" || Boolean(state?.inFlight);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SectionHeading title="Results" />
      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {extracting ? (
          <div className="flex items-center gap-3 text-sm text-ink">
            <Spinner />
            <span>{COPY.EXTRACTING_LONG}</span>
          </div>
        ) : null}

        {!extracting && result.kind === "idle" && attempts.length === 0 ? (
          <p className="text-sm text-muted">{COPY.IDLE}</p>
        ) : null}

        {!extracting && result.kind === "job" ? (
          <SavedView
            tone="success"
            message={result.message || COPY.JOB_CREATED}
            record={result.record}
            recordLabel="Job"
            recordId={result.jobId}
            footer={COPY.JOB_SAVED}
            onOpenWebsite={onOpenWebsite}
          />
        ) : null}

        {!extracting && result.kind === "draft" ? (
          <SavedView
            tone="draft"
            message={result.message || COPY.DRAFT_MESSAGE}
            record={result.record}
            recordLabel="Draft"
            recordId={result.draftId}
            failureCategory={result.failureCategory}
            failureReason={result.failureReason}
            footer={COPY.DRAFT_STORED}
            onOpenWebsite={onOpenWebsite}
          />
        ) : null}

        {!extracting && result.kind === "already_saved" ? (
          <div className="space-y-3">
            <StatusCard tone="info" message={result.message} />
            <button
              type="button"
              onClick={onOpenWebsite}
              className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover"
            >
              Open Copilot
            </button>
          </div>
        ) : null}

        {!extracting && (result.kind === "error" || result.kind === "offer_fallback") ? (
          <div className="space-y-3">
            <StatusCard tone="danger" message={result.message} />
            {result.offerFallback ? (
              <>
                <p className="text-sm text-ink">{COPY.FALLBACK_CTA}</p>
                <button
                  type="button"
                  disabled={sendDisabled}
                  onClick={onConfirmFallback}
                  className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Capture page text and retry
                </button>
              </>
            ) : result.kind === "offer_fallback" ? (
              <p className="text-sm text-ink">
                This page could not be fetched. Paste the job text in Capture and send it from there.
              </p>
            ) : (
              <p className="text-xs text-muted">Send again to retry.</p>
            )}
          </div>
        ) : null}

        {!extracting && result.kind === "need_connect" ? (
          <div className="space-y-3">
            <StatusCard tone="danger" message={result.message || COPY.CONNECT_PROMPT} />
            <p className="text-xs text-muted">{COPY.CONNECT_SUBTEXT}</p>
            <button
              type="button"
              onClick={onConnect}
              className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover"
            >
              {COPY.CONNECT_LABEL}
            </button>
          </div>
        ) : null}

        {!extracting && result.kind === "rate_limited" ? (
          <div className="space-y-2">
            <StatusCard tone="info" message={result.message || COPY.RATE_LIMIT} />
            {waitSeconds > 0 ? <p className="text-sm text-muted">Try again in {waitSeconds}s.</p> : null}
          </div>
        ) : null}

        {attempts.length > 0 ? (
          <section>
            <h3 className="text-xs font-medium tracking-wide text-muted uppercase">This session</h3>
            <ul className="mt-2 space-y-2">
              {attempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex items-start gap-2.5 rounded-2xl border border-line bg-white px-3 py-1.5"
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(attempt.status)}`}
                    title={dotLabel(attempt.status)}
                    aria-label={dotLabel(attempt.status)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{attemptTitle(attempt)}</p>
                      <p className="shrink-0 text-[11px] text-muted">{formatTime(attempt.createdAt)}</p>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {originLabel(attempt.origin)} · {attemptStatusLabel(attempt.status)}
                      {attempt.jobId != null ? ` · Job ${attempt.jobId}` : ""}
                      {attempt.draftId != null ? ` · Draft ${attempt.draftId}` : ""}
                    </p>
                    {attempt.message ? (
                      <p className="mt-1 line-clamp-2 text-xs break-words text-muted">{attempt.message}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SavedView({
  tone,
  message,
  record,
  recordLabel,
  recordId,
  failureCategory,
  failureReason,
  footer,
  onOpenWebsite,
}) {
  const hint = failureCategoryHint(failureCategory);
  const score = record?.resumeToJobScore;
  return (
    <div className="space-y-3">
      <StatusCard tone={tone} message={message} />
      {failureReason ? <p className="text-sm break-words text-ink">{failureReason}</p> : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <dl className="grid grid-cols-1 gap-2.5 rounded-2xl border border-line bg-white p-3">
        <Field label={recordLabel} value={recordId != null ? String(recordId) : ""} />
        <Field label="Title" value={record?.title} />
        <Field label="Company" value={record?.company} />
        <Field label="Location" value={record?.location} />
        <Field label="URL" value={record?.sourceUrl} />
        <Field label="Match score" value={score == null ? "" : String(score)} />
        <Field label="Skills" value={record?.skills} />
      </dl>
      <details className="rounded-2xl border border-line bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-ink">More</summary>
        <dl className="mt-3 grid grid-cols-1 gap-3">
          <Field label="Employment type" value={record?.employmentType} />
          <Field label="Work mode" value={record?.workMode} />
          <Field label="Experience" value={record?.experience} />
          <Field label="Salary" value={record?.salary} />
          <Field label="Education" value={record?.education} />
          <Field label="Department" value={record?.department} />
          <Field label="Industry" value={record?.industry} />
          <Field label="Source platform" value={record?.sourcePlatform} />
          <Field label="Description" value={record?.description} />
        </dl>
      </details>
      <p className="text-xs text-muted">{footer}</p>
      <button
        type="button"
        onClick={onOpenWebsite}
        className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover"
      >
        Open Copilot
      </button>
    </div>
  );
}
