"use client";

export function KpiCard({ title, value, suffix }) {
	const formatted = typeof value === "number"
		? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
		: (value ?? 0);

	return (
		<div className="card p-4">
			<div className="text-xs text-slate-400">{title}</div>
			<div className="text-2xl font-semibold mt-1 text-slate-50">
				{formatted}
				{suffix ? <span className="text-sm text-slate-400 ml-1">{suffix}</span> : null}
			</div>
		</div>
	);
}
