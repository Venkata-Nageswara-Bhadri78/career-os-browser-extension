import { PaperPlaneIcon } from "./Icons.jsx";

export function SendButton({ disabled, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-accent text-[13px] font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PaperPlaneIcon className="h-4 w-4" />
      {busy ? "Submitting…" : "Send"}
    </button>
  );
}
