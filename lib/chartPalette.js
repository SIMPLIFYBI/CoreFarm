export const CHART_PALETTE = [
	"#003f5c",
	"#31497e",
	"#4d4d8a",
	"#674f95",
	"#855095",
	"#a14e9a",
	"#d44c8d",
	"#f9596f",
	"#ff6a5a",
	"#ff7a47",
	"#ff9140",
	"#ffa600",
];

export const PRIMARY_CHART_COLOR = CHART_PALETTE[1];
export const ACCENT_CHART_COLOR = CHART_PALETTE[5];

export function getChartColor(index) {
	if (!CHART_PALETTE.length) return "#64748b";
	const safeIndex = Number.isFinite(index) ? index : 0;
	return CHART_PALETTE[((safeIndex % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length];
}