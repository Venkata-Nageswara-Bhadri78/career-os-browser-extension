import { COPY } from "../lib/errors.js";
import { SectionHeading } from "./ExtractionForms.jsx";

export function ResumeList({
  connection,
  resumes,
  selectedResumeId,
  loaded,
  error,
  loading,
  onSelect,
  onRefresh,
  onConnect,
}) {
  const items = Array.isArray(resumes) ? resumes : [];
  const showConnect = connection !== "connected";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading title="Resumes" />
        {connection === "connected" ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        The selected resume is sent with each job. Priority is the default.
      </p>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {showConnect ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">{connection === "expired" ? COPY.EXPIRED : COPY.CONNECT_PROMPT}</p>
            <button
              type="button"
              onClick={onConnect}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              {COPY.CONNECT_LABEL}
            </button>
          </div>
        ) : null}

        {!showConnect && (loading || !loaded) && items.length === 0 ? (
          <p className="text-sm text-muted">Loading resumes…</p>
        ) : null}

        {!showConnect && error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        {!showConnect && loaded && !loading && items.length === 0 && !error ? (
          <p className="text-sm text-muted">No resumes on your profile.</p>
        ) : null}

        {!showConnect && items.length > 0 ? (
          <div role="radiogroup" aria-label="Resumes" className="space-y-2">
            {items.map((resume) => {
              const selected = resume.id === selectedResumeId;
              return (
                <button
                  key={resume.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(resume.id)}
                  className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left ${
                    selected ? "border-accent bg-sidebar-active" : "border-line bg-white hover:bg-page"
                  }`}
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full border ${
                      selected ? "border-accent bg-accent" : "border-line bg-white"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 items-baseline gap-1 truncate text-sm font-medium text-ink">
                    <span className="truncate">{resume.name}</span>
                    {resume.highPriority ? (
                      <span className="shrink-0 font-normal text-muted">(Priority)</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
