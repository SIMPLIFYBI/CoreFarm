"use client";

export default function TabButton({ active, onClick, label, disabled, title }) {
  return (
    <button
      type="button"
      className={[
        "rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.2)]" : "text-slate-200 hover:bg-white/8",
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