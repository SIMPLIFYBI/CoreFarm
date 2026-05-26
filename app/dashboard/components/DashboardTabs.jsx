"use client";

import HorizontalScrollTabs from "@/app/components/HorizontalScrollTabs";

export function DashboardTabs({ tab, setTab }) {
	return (
		<HorizontalScrollTabs className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5" hint="Swipe tabs" hintClassName="text-slate-500">
			<button
				className={`rounded-xl px-4 py-2 font-medium text-sm transition-colors ${
					tab === "dashboard"
						? "bg-white/[0.08] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
						: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
				}`}
				onClick={() => setTab("dashboard")}
			>
				Dashboard
			</button>
			<button
				className={`rounded-xl px-4 py-2 font-medium text-sm transition-colors ${
					tab === "plods"
						? "bg-white/[0.08] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
						: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
				}`}
				onClick={() => setTab("plods")}
			>
				Plods
			</button>
			<button
				className={`rounded-xl px-4 py-2 font-medium text-sm transition-colors ${
					tab === "activity"
						? "bg-white/[0.08] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
						: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
				}`}
				onClick={() => setTab("activity")}
			>
				Logging Activity
			</button>
			<button
				className={`rounded-xl px-4 py-2 font-medium text-sm transition-colors ${
					tab === "consumables"
						? "bg-white/[0.08] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
						: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
				}`}
				onClick={() => setTab("consumables")}
			>
				Consumables
			</button>
		</HorizontalScrollTabs>
	);
}
