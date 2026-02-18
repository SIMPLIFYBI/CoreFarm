"use client";

export function DashboardTabs({ tab, setTab }) {
	return (
		<div className="mb-6 flex gap-2 border-b border-white/5">
			<button
				className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
					tab === "dashboard"
						? "border-indigo-400 text-slate-50"
						: "border-transparent text-slate-400 hover:text-slate-200"
				}`}
				onClick={() => setTab("dashboard")}
			>
				Dashboard
			</button>
			<button
				className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
					tab === "project"
						? "border-indigo-400 text-slate-50"
						: "border-transparent text-slate-400 hover:text-slate-200"
				}`}
				onClick={() => setTab("project")}
			>
				Project
			</button>
			<button
				className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
					tab === "plods"
						? "border-indigo-400 text-slate-50"
						: "border-transparent text-slate-400 hover:text-slate-200"
				}`}
				onClick={() => setTab("plods")}
			>
				Plods
			</button>
			<button
				className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
					tab === "activity"
						? "border-indigo-400 text-slate-50"
						: "border-transparent text-slate-400 hover:text-slate-200"
				}`}
				onClick={() => setTab("activity")}
			>
				Logging Activity
			</button>
			<button
				className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${
					tab === "consumables"
						? "border-indigo-400 text-slate-50"
						: "border-transparent text-slate-400 hover:text-slate-200"
				}`}
				onClick={() => setTab("consumables")}
			>
				Consumables
			</button>
		</div>
	);
}
