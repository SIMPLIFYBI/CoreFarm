"use client";

function ActionIconButton({ label, onClick, children, variant = "default", disabled = false }) {
  const base =
    "inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/60";
  const styles =
    variant === "danger"
      ? "border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20"
      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";

  return (
    <button
      type="button"
      className={`${base} ${styles}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function EditIconButton({ onClick, disabled = false, label = "Edit" }) {
  return (
    <ActionIconButton label={label} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
      </svg>
    </ActionIconButton>
  );
}

export function DeleteIconButton({ onClick, disabled = false, label = "Delete" }) {
  return (
    <ActionIconButton label={label} onClick={onClick} variant="danger" disabled={disabled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </ActionIconButton>
  );
}

export default ActionIconButton;