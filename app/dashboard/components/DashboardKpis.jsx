	"use client";

	import { KpiCard } from "./KpiCard";

export function DashboardKpis({ byType, orientationAvg, unloggedMeters, trend }) {
	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
			<KpiCard title="Total meters" value={sum(byType.map((d) => d.value))} suffix=" m" />
			<KpiCard title="Avg Orientated / day" value={orientationAvg} suffix=" m" />
			<KpiCard title="Un-logged metres" value={unloggedMeters} suffix=" m" />
			<KpiCard title="Avg m/day" value={avg(trend.map((p) => p.value))} suffix=" m" />
		</div>
	);
}

function sum(arr) {
	return Math.round((arr.reduce((a, b) => a + (Number(b) || 0), 0) + Number.EPSILON) * 10) / 10;
}
function avg(arr) {
	if (!arr.length) return 0;
	return Math.round(((arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length) + Number.EPSILON) * 10) / 10;
}
