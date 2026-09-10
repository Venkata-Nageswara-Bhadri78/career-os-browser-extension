import { PaperPlaneIcon } from "./Icons.jsx";

export function SendButton({ disabled, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PaperPlaneIcon className="h-4 w-4" />
      {busy ? "Extracting…" : "Send"}
    </button>
  );
}
