"use client";

export function DashboardFilters({
	fromDate,
	toDate,
	setFromDate,
	setToDate,
	types,
	setTypes,
	allTaskTypes,
	typeOptions,
	taskSelectOpen,
	setTaskSelectOpen,
	buttonLabel,
	selectedLabels,
	toggleType,
}) {
	return (
		<div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 relative z-30 overflow-visible">
			<div>
				<label className="block text-xs text-slate-300 mb-1">From</label>
				<input
					type="date"
					value={fromDate}
					onChange={(e) => setFromDate(e.target.value)}
					className="input input-sm bg-slate-900/60 border-slate-600/60"
				/>
			</div>
			<div>
				<label className="block text-xs text-slate-300 mb-1">To</label>
				<input
					type="date"
					value={toDate}
					onChange={(e) => setToDate(e.target.value)}
					className="input input-sm bg-slate-900/60 border-slate-600/60"
				/>
			</div>
			<div className="relative">
				<label className="block text-xs text-slate-300 mb-1">Task types</label>
				<button
					type="button"
					onClick={() => setTaskSelectOpen((o) => !o)}
					className="input input-sm flex items-center justify-between cursor-pointer bg-slate-900/60 border-slate-600/60 hover:border-indigo-400/80"
				>
					<span className="flex items-center gap-2">
						<span className="flex -space-x-1">
							{typeOptions
								.filter((o) => types.includes(o.key))
								.slice(0, 5)
								.map((o) => (
									<span
										key={o.key}
										className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-900/90"
										style={{ background: o.color }}
									/>
								))}
							{selectedLabels.length > 5 && (
								<span className="inline-block h-3 w-3 rounded-full bg-slate-600 text-[8px] flex items-center justify-center ring-1 ring-slate-900/90">
									+{selectedLabels.length - 5}
								</span>
							)}
						</span>
						<span className="truncate max-w-[9rem] md:max-w-[12rem] text-xs text-slate-100">{buttonLabel}</span>
					</span>
					<span className="text-slate-400 text-[10px]">{taskSelectOpen ? "\u25b2" : "\u25bc"}</span>
				</button>
				{taskSelectOpen && (
						<div className="absolute mt-1 w-full max-h-64 overflow-auto rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/50 backdrop-blur-xl z-50 text-xs">
							<div className="sticky top-0 bg-slate-900/98 p-2 flex items-center gap-2 border-b border-slate-700/80">
								<button type="button" className="btn btn-xs" onClick={() => setTypes(allTaskTypes)}>
								Select all
							</button>
							<button
								type="button"
								className="btn btn-xs"
									onClick={() => setTypes((prev) => (prev.length === allTaskTypes.length ? [allTaskTypes[0]] : allTaskTypes))}
							>
								Toggle bulk
							</button>
						</div>
						<ul className="divide-y divide-slate-800/80">
							{typeOptions.map((opt) => {
								const active = types.includes(opt.key);
								return (
									<li key={opt.key}>
										<button
											type="button"
											onClick={() => toggleType(opt.key)}
											className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
												active
													? "bg-indigo-500/15 hover:bg-indigo-500/25"
													: "hover:bg-slate-800/70"
											}`}
										>
											<span
												className="inline-block h-3 w-3 rounded"
												style={{ background: opt.color }}
											/>
											<span className="flex-1 truncate text-slate-100">{opt.label}</span>
											<span
												className={`text-[10px] ${
													active ? "text-indigo-300" : "text-slate-500"
											}`}
											>
												{active ? "\u2714" : ""}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
						<div className="p-2 text-right border-t border-slate-800/80 bg-slate-900/95">
							<button type="button" className="btn btn-xs" onClick={() => setTaskSelectOpen(false)}>
								Close
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
