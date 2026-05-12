"use client";

export function KpiCard({ title, value, suffix }) {
	const formatted = typeof value === "number"
		? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
		: (value ?? 0);

	return (
		<div className="glass rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_48px_rgba(2,6,23,0.16)]">
			<div className="text-xs uppercase tracking-[0.18em] text-slate-300">{title}</div>
			<div className="mt-2 text-2xl font-semibold text-slate-50">
				{formatted}
				{suffix ? <span className="text-sm text-slate-400 ml-1">{suffix}</span> : null}
			</div>
		</div>
	);
}
