export function PaperPlaneIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function LinkIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 0 0 7.07.07l1.41-1.41a5 5 0 0 0-7.07-7.07l-.72.71"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 11a5 5 0 0 0-7.07-.07l-1.41 1.41a5 5 0 0 0 7.07 7.07l.71-.71"
      />
    </svg>
  );
}

export function EllipsisIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6 9 12l6 6" />
    </svg>
  );
}
