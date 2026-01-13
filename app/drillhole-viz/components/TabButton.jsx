"use client";

export default function TabButton({ active, onClick, label, disabled, title }) {
  return (
    <button
      type="button"
      className={[
        "px-3 py-2 -mb-px border-b-2 text-sm transition-colors",
        active ? "border-indigo-500 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}