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
	const openNativeDatePicker = (event) => {
		event.currentTarget.showPicker?.();
	};

	return (
		<section className="glass rounded-2xl border border-white/10 p-4 md:p-5 mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 relative z-30 overflow-visible">
			<div>
				<label className="block text-xs text-slate-300 mb-1">Date From</label>
				<input
					type="date"
					value={fromDate}
					onChange={(e) => setFromDate(e.target.value)}
					onClick={openNativeDatePicker}
					className="input compact-mobile-date-input mt-1 h-10 w-full text-[11px]"
				/>
			</div>
			<div>
				<label className="block text-xs text-slate-300 mb-1">Date To</label>
				<input
					type="date"
					value={toDate}
					onChange={(e) => setToDate(e.target.value)}
					onClick={openNativeDatePicker}
					className="input compact-mobile-date-input mt-1 h-10 w-full text-[11px]"
				/>
			</div>
			<div className="relative">
				<label className="block text-xs text-slate-300 mb-1">Task types</label>
				<button
					type="button"
					onClick={() => setTaskSelectOpen((o) => !o)}
					className="input mt-1 flex h-10 items-center justify-between cursor-pointer hover:border-cyan-300/40"
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
						<div className="absolute mt-2 w-full max-h-64 overflow-auto rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur-xl z-50 text-xs">
							<div className="sticky top-0 flex items-center gap-2 border-b border-white/10 bg-slate-950/95 p-2">
								<button type="button" className="btn btn-3d-glass btn-xs" onClick={() => setTypes(allTaskTypes)}>
								Select all
							</button>
							<button
								type="button"
								className="btn btn-3d-glass btn-xs"
									onClick={() => setTypes((prev) => (prev.length === allTaskTypes.length ? [allTaskTypes[0]] : allTaskTypes))}
							>
								Toggle bulk
							</button>
						</div>
						<ul className="divide-y divide-white/5">
							{typeOptions.map((opt) => {
								const active = types.includes(opt.key);
								return (
									<li key={opt.key}>
										<button
											type="button"
											onClick={() => toggleType(opt.key)}
											className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
												active
													? "bg-cyan-400/10 hover:bg-cyan-400/16"
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
													active ? "text-cyan-300" : "text-slate-500"
											}`}
											>
												{active ? "\u2714" : ""}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
						<div className="border-t border-white/10 bg-slate-950/95 p-2 text-right">
							<button type="button" className="btn btn-3d-glass btn-xs" onClick={() => setTaskSelectOpen(false)}>
								Close
							</button>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
