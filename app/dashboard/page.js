"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { DEFAULT_TASK_TYPE_DEFS, TASK_TYPES, fetchOrgTaskTypes } from "@/lib/taskTypes";
import { getChartColor } from "@/lib/chartPalette";
import { buildLowConsumableRows, getConsumableStatusMeta } from "@/lib/consumableInventory";
import { BarChart, DonutChart, StackedColumnChart } from "@/app/components/Charts";
import { DashboardTabs } from "./components/DashboardTabs";
import { DashboardFilters } from "./components/DashboardFilters";
import { DashboardKpis } from "./components/DashboardKpis";

export default function UserDashboardPage() {
	const supabase = supabaseBrowser();
	const defaultTaskOptions = useMemo(
		() =>
			DEFAULT_TASK_TYPE_DEFS.map((task, index) => ({
				key: task.key,
				label: shortLabelForTask(task.key, task.name),
				color: getChartColor(index),
			})),
		[]
	);
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const { orgId } = useOrg();
	const [tab, setTab] = useState("dashboard"); // 'dashboard' | 'project' | 'plods' | 'activity' | 'consumables'
	const [consumableItems, setConsumableItems] = useState([]);
	const [consumableTrend, setConsumableTrend] = useState([]);
	const [consumableLoading, setConsumableLoading] = useState(false);

	const [fromDate, setFromDate] = useState(() => {
		const d = new Date();
		d.setMonth(d.getMonth() - 6);
		return d.toISOString().slice(0, 10);
	});
	const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [types, setTypes] = useState(TASK_TYPES);
	const [typeOptions, setTypeOptions] = useState(defaultTaskOptions);
	const previousTypeKeysRef = useRef(TASK_TYPES);
	const [taskSelectOpen, setTaskSelectOpen] = useState(false);

	const [byType, setByType] = useState([]);
	const [trend, setTrend] = useState([]);
	const [stacked14, setStacked14] = useState([]);
	const [orientationAvg, setOrientationAvg] = useState(0);
	const [unloggedMeters, setUnloggedMeters] = useState(0);

	const [activityRows, setActivityRows] = useState([]);
	const [activityLoading, setActivityLoading] = useState(false);
	const [editRowId, setEditRowId] = useState(null);
	const [editRow, setEditRow] = useState({});

	useEffect(() => {
		let sub;
		(async () => {
			const { data: userData } = await supabase.auth.getUser();
			setUser(userData?.user || null);
			const { data: s } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
			sub = s?.subscription;
			setLoading(false);
		})();
		return () => sub?.unsubscribe?.();
	}, [supabase]);

	useEffect(() => {
		let active = true;
		const previousKeys = previousTypeKeysRef.current;

		(async () => {
			try {
				const tasks = await fetchOrgTaskTypes(supabase, orgId);
				if (!active) return;

				const nextOptions = tasks.map((task, index) => ({
					key: task.key,
					label: shortLabelForTask(task.key, task.name),
					color: getChartColor(index),
				}));
				const nextKeys = nextOptions.map((option) => option.key);

				previousTypeKeysRef.current = nextKeys;
				setTypeOptions(nextOptions);
				setTypes((prev) => {
					const wasAllSelected =
						previousKeys.length > 0 &&
						prev.length === previousKeys.length &&
						previousKeys.every((key) => prev.includes(key));

					if (wasAllSelected) return nextKeys;

					const filtered = prev.filter((key) => nextKeys.includes(key));
					return filtered.length > 0 ? filtered : nextKeys;
				});
			} catch (error) {
				console.error("Could not load org task types", error);
				if (!active) return;
				previousTypeKeysRef.current = TASK_TYPES;
				setTypeOptions(defaultTaskOptions);
				setTypes((prev) => {
					const filtered = prev.filter((key) => TASK_TYPES.includes(key));
					return filtered.length > 0 ? filtered : TASK_TYPES;
				});
			}
		})();

		return () => {
			active = false;
		};
	}, [defaultTaskOptions, orgId, supabase]);


	useEffect(() => {
		if (tab !== "activity" || !user) return;
		setActivityLoading(true);
		(async () => {
			const { data: rows } = await supabase
				.from("hole_task_progress")
				.select("id, hole_id, task_type, from_m, to_m, logged_on, holes(hole_id)")
				.eq("user_id", user.id)
				.order("logged_on", { ascending: false });
			setActivityRows(rows || []);
			setActivityLoading(false);
		})();
	}, [tab, user, supabase]);

	useEffect(() => {
		if (tab !== "consumables" || !orgId) return;
		(async () => {
			setConsumableLoading(true);
			try {
				const [{ data: inv }, { data: inventoryRows }] = await Promise.all([
					supabase
						.from("consumable_items")
						.select("id,key,label,count,reorder_value,cost_per_unit,unit_size,include_in_report")
						.eq("organization_id", orgId)
						.order("label"),
					supabase
						.from("consumable_location_inventory")
						.select("id, consumable_item_id, location_id, count, reorder_value, asset_locations(name)")
						.eq("organization_id", orgId),
				]);
				const allItems = inv || [];
				const lowReorder = buildLowConsumableRows(allItems, inventoryRows || []);
				setConsumableItems(lowReorder);

				const includedForTrend = allItems.filter((i) => i.include_in_report);
				const includedKeys = new Set(includedForTrend.map((i) => i.key));
				const { data: orderedItems } = await supabase
					.from("purchase_order_items")
					.select("created_at, quantity, status, item_key, label, po:purchase_orders(status, ordered_date)")
					.eq("organization_id", orgId);
				const monthMap = {};
				for (const row of orderedItems || []) {
					if (!includedKeys.has(row.item_key)) continue;
					const isOrdered =
						row.status === "ordered" ||
						row.status === "received" ||
						(row.po && (row.po.status === "ordered" || row.po.status === "received"));
					if (!isOrdered) continue;
					const dt = row.po?.ordered_date || row.created_at || new Date().toISOString();
					const month = (dt || "").slice(0, 7);
					if (!month) continue;
					monthMap[month] = (monthMap[month] || 0) + (row.quantity || 0);
				}
				const now = new Date();
				const months = [];
				for (let i = 5; i >= 0; i--) {
					const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
					months.push(d.toISOString().slice(0, 7));
				}
				setConsumableTrend(months.map((m) => ({ label: m, value: monthMap[m] || 0 })));
			} catch (e) {
				console.error(e);
				setConsumableItems([]);
				setConsumableTrend([]);
			} finally {
				setConsumableLoading(false);
			}
		})();
	}, [tab, orgId, supabase]);

	const allTaskTypes = useMemo(() => typeOptions.map((option) => option.key), [typeOptions]);
	const taskLabelMap = useMemo(
		() => Object.fromEntries(typeOptions.map((option) => [option.key, option.label])),
		[typeOptions]
	);

	useEffect(() => {
		if (!orgId) return;
		(async () => {
			setLoading(true);
			try {
				const { data: holes } = await supabase.from("holes").select("id").eq("organization_id", orgId);
				const holeIds = (holes || []).map((h) => h.id);
				if (holeIds.length === 0) {
					setByType([]);
					setTrend([]);
					setStacked14([]);
					setOrientationAvg(0);
					setUnloggedMeters(0);
					setLoading(false);
					return;
				}

				try {
					const { data: completionRows } = await supabase
						.from("hole_completion_summary")
						.select("hole_id, planned_total_m, done_total_m")
						.in("hole_id", holeIds);
					let remaining = 0;
					for (const r of completionRows || []) {
						const planned = Number(r.planned_total_m) || 0;
						const done = Number(r.done_total_m) || 0;
						const rem = planned - done;
						if (rem > 0) remaining += rem;
					}
					setUnloggedMeters(remaining);
				} catch {
					setUnloggedMeters(0);
				}

				let q = supabase
					.from("hole_task_progress")
					.select("hole_id, task_type, from_m, to_m, logged_on")
					.in("hole_id", holeIds)
					.gte("logged_on", fromDate)
					.lte("logged_on", toDate);
				if ((types || []).length > 0 && types.length < allTaskTypes.length) q = q.in("task_type", types);
				const { data: rows, error } = await q;
				if (error) throw error;

				const metersByType = {};
				for (const r of rows || []) {
					const m = Number(r.to_m) - Number(r.from_m);
					if (!Number.isFinite(m) || m <= 0) continue;
					metersByType[r.task_type] = (metersByType[r.task_type] || 0) + m;
				}
				const pie = typeOptions
					.map((option, index) => ({
						key: option.key,
						label: option.label,
						value: metersByType[option.key] || 0,
						color: option.color || getChartColor(index),
					}))
					.filter((d) => types.includes(d.key));
				setByType(pie);

				const byDateTotal = {};
				const byDateTask = {};
				for (const r of rows || []) {
					const m = Number(r.to_m) - Number(r.from_m);
					if (!Number.isFinite(m) || m <= 0) continue;
					const day = String(r.logged_on);
					byDateTotal[day] = (byDateTotal[day] || 0) + m;
					byDateTask[day] = byDateTask[day] || {};
					byDateTask[day][r.task_type] = (byDateTask[day][r.task_type] || 0) + m;
				}
				const days = eachDay(fromDate, toDate);
				setTrend(days.map((d) => ({ label: d, value: byDateTotal[d] || 0 })));
				const orientationTotal = metersByType.orientation || 0;
				const orientationDays = Object.values(byDateTask).filter((m) => (m.orientation || 0) > 0).length;
				setOrientationAvg(orientationDays ? orientationTotal / orientationDays : 0);

				const to = new Date(`${toDate}T00:00:00`);
				const last14 = [];
				for (let i = 13; i >= 0; i--) {
					const d = new Date(to);
					d.setDate(d.getDate() - i);
					const key = d.toISOString().slice(0, 10);
					const taskMap = byDateTask[key] || {};
					const segments = typeOptions
						.filter((option) => types.includes(option.key))
						.map((option, idx) => ({
							key: option.key,
							label: option.label,
							color: option.color || getChartColor(idx),
							value: taskMap[option.key] || 0,
						}))
						.filter((s) => s.value > 0);
					last14.push({ date: key, segments, total: segments.reduce((a, b) => a + b.value, 0) });
				}
				setStacked14(last14);
			} catch (e) {
				console.error(e);
				setByType([]);
				setTrend([]);
				setStacked14([]);
				setOrientationAvg(0);
				setUnloggedMeters(0);
			} finally {
				setLoading(false);
			}
		})();
	}, [allTaskTypes.length, fromDate, orgId, supabase, toDate, typeOptions, types]);

	const toggleType = (t) => {
		setTypes((prev) => {
			const exists = prev.includes(t);
			if (exists) {
				const next = prev.filter((x) => x !== t);
				return next.length === 0 ? prev : next;
			}
			return [...prev, t];
		});
	};

	const allSelected = types.length === allTaskTypes.length;
	const selectedLabels = typeOptions.filter((o) => types.includes(o.key)).map((o) => o.label);
	const buttonLabel = allSelected
		? `All Tasks (${types.length})`
		: selectedLabels.slice(0, 3).join(", ") + (selectedLabels.length > 3 ? ` +${selectedLabels.length - 3}` : "");

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
			<section className="card p-4 md:p-5">
				<h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
				<p className="mt-1 text-sm text-slate-300">
					Track logged metres, activity mix, production trend, and consumable pressure from the same reporting workspace.
				</p>
			</section>

			<DashboardTabs tab={tab} setTab={setTab} />

			{tab === "dashboard" && (
				<>
					<DashboardFilters
						fromDate={fromDate}
						toDate={toDate}
						setFromDate={setFromDate}
						setToDate={setToDate}
						types={types}
						setTypes={setTypes}
						allTaskTypes={allTaskTypes}
						typeOptions={typeOptions}
						taskSelectOpen={taskSelectOpen}
						setTaskSelectOpen={setTaskSelectOpen}
						buttonLabel={buttonLabel}
						selectedLabels={selectedLabels}
						toggleType={toggleType}
					/>

					<DashboardKpis byType={byType} orientationAvg={orientationAvg} unloggedMeters={unloggedMeters} trend={trend} />

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="glass rounded-2xl border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:p-5 shadow-[0_18px_50px_rgba(8,47,73,0.16)]">
							<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Meters by task type</div>
							<div className="mt-1 text-xs text-slate-300">Quick comparison across the selected reporting window.</div>
							<BarChart data={byType} />
						</div>
						<div className="glass rounded-2xl border border-sky-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:p-5 shadow-[0_18px_50px_rgba(14,116,144,0.14)]">
							<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Distribution</div>
							<div className="mt-1 text-xs text-slate-300">Share of logged metres by task type.</div>
							<DonutChart data={byType} />
						</div>
						<div className="glass rounded-2xl border border-indigo-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 md:col-span-2 md:p-5 shadow-[0_18px_50px_rgba(67,56,202,0.12)]">
							<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Daily production (last 14 days)</div>
							<div className="mt-1 text-xs text-slate-300">Short-range production rhythm with stacked task contribution.</div>
							<StackedColumnChart data={stacked14} height={160} fullBleed />
						</div>
					</div>

					{loading && (
						<section className="glass rounded-2xl border border-white/10 p-4 text-sm text-slate-300">
							Loading dashboard…
						</section>
					)}
					{!loading && byType.length === 0 && (
						<section className="glass rounded-2xl border border-white/10 p-4 text-sm text-slate-300">
							No data in the selected range.
						</section>
					)}
				</>
			)}

			{tab === "activity" && (
				<section className="card p-4 md:p-5">
					<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Logging Activity</div>
					<div className="mt-2 text-base font-semibold text-slate-100">My logging activity</div>
					{activityLoading ? (
						<div className="mt-3 text-sm text-slate-400">Loading...</div>
					) : activityRows.length === 0 ? (
						<div className="mt-3 text-sm text-slate-400">No logging activity found.</div>
					) : (
						<div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
							<table className="w-full min-w-[500px] text-[10px] border border-slate-700/70">
								<thead className="bg-slate-900/80 text-slate-100">
									<tr>
										<th className="p-1 border border-slate-700/70">Hole</th>
										<th className="p-1 border border-slate-700/70">Task</th>
										<th className="p-1 border border-slate-700/70">Interval (m)</th>
										<th className="p-1 border border-slate-700/70">Date</th>
										<th className="p-1 border border-slate-700/70">Actions</th>
									</tr>
								</thead>
								<tbody className="bg-slate-900/60 text-slate-100">
									{activityRows.map((row) => (
										<tr key={row.id} className="border-t border-slate-800/80 hover:bg-slate-800/70">
											<td className="p-1 border border-slate-800/80">{row.holes?.hole_id || row.hole_id}</td>
											<td className="p-1 border border-slate-800/80">{taskLabelMap[row.task_type] || shortLabelForTask(row.task_type)}</td>
											<td className="p-1 border border-slate-800/80">{row.from_m} - {row.to_m}</td>
											<td className="p-1 border border-slate-800/80">{row.logged_on}</td>
											<td className="p-1 border border-slate-800/80 whitespace-nowrap">
												{editRowId === row.id ? (
													<>
														<input
															type="number"
															className="input input-xs w-12 mr-1"
															value={editRow.from_m}
															onChange={(e) => setEditRow((r) => ({ ...r, from_m: e.target.value }))}
														/>
														<input
															type="number"
															className="input input-xs w-12 mr-1"
															value={editRow.to_m}
															onChange={(e) => setEditRow((r) => ({ ...r, to_m: e.target.value }))}
														/>
														<input
															type="date"
															className="input input-xs w-16 mr-1"
															value={editRow.logged_on}
															onChange={(e) => setEditRow((r) => ({ ...r, logged_on: e.target.value }))}
														/>
														<button
															className="btn btn-primary btn-xs px-2 py-0 mr-1"
															onClick={async () => {
																await supabase
																	.from("hole_task_progress")
																	.update({ from_m: editRow.from_m, to_m: editRow.to_m, logged_on: editRow.logged_on })
																	.eq("id", row.id);
																setEditRowId(null);
																setEditRow({});
																const { data: rows } = await supabase
																	.from("hole_task_progress")
																	.select("id, hole_id, task_type, from_m, to_m, logged_on, holes(hole_id)")
																	.eq("user_id", user.id)
																	.order("logged_on", { ascending: false });
																setActivityRows(rows || []);
															}}
														>Save</button>
														<button className="btn btn-xs px-2 py-0" onClick={() => { setEditRowId(null); setEditRow({}); }}>Cancel</button>
													</>
												) : (
													<>
														<button
															className="btn btn-xs px-2 py-0 mr-1"
															onClick={() => {
																setEditRowId(row.id);
																setEditRow({ from_m: row.from_m, to_m: row.to_m, logged_on: row.logged_on });
															}}
														>
															Amend
														</button>
														<button
															className="btn btn-danger btn-xs px-2 py-0"
															onClick={async () => {
																await supabase.from("hole_task_progress").delete().eq("id", row.id);
																const { data: rows } = await supabase
																	.from("hole_task_progress")
																	.select("id, hole_id, task_type, from_m, to_m, logged_on, holes(hole_id)")
																	.eq("user_id", user.id)
																	.order("logged_on", { ascending: false });
																setActivityRows(rows || []);
															}}
														>
															Delete
														</button>
													</>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			)}

			{tab === "project" && <div />}
			{tab === "plods" && <div />}

			{tab === "consumables" && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-6">
						<section className="card p-4 md:p-5">
							<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Consumables</div>
							<div className="mt-2 text-base font-semibold text-slate-100">Low / Reorder inventory</div>
							{consumableLoading ? (
								<div className="mt-3 text-xs text-slate-400">Loading...</div>
							) : consumableItems.length === 0 ? (
								<div className="mt-3 text-xs text-slate-400">No items currently Low or at Reorder threshold.</div>
							) : (
								<div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/35">
									<table className="w-full text-xs md:text-sm">
										<thead>
											<tr className="text-left bg-slate-900/80 text-slate-100">
												<th className="p-2">Item</th>
												<th className="p-2">Location</th>
												<th className="p-2 text-right">Count</th>
												<th className="p-2 text-right">Status</th>
											</tr>
										</thead>
										<tbody>
											{consumableItems.map((it) => {
												const { badgeClass: cls, label: txt } = getConsumableStatusMeta(it.count, it.reorder_value);
												return (
													<tr key={it.key} className="border-b border-slate-800/80 last:border-b-0 text-slate-100">
														<td className="p-2">{it.label}</td>
														<td className="p-2">{it.location_name || "All locations"}</td>
														<td className="p-2 text-right">{it.count}</td>
														<td className="p-2 text-right">
															<span className={`badge ${cls} text-[10px]`}>{txt}</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</section>
					</div>
				</div>
			)}
		</div>
	);
}

function shortLabelForTask(t, fallbackLabel) {
	return (
		{
			orientation: "Orientation",
			magnetic_susceptibility: "Mag Sus",
			whole_core_sampling: "WC Samp",
			cutting: "Cutting",
			rqd: "RQD",
			specific_gravity: "SG",
		}[t] || fallbackLabel || t
	);
}

function eachDay(from, to) {
	const out = [];
	const d = new Date(from);
	const end = new Date(to);
	while (d <= end) {
		out.push(d.toISOString().slice(0, 10));
		d.setDate(d.getDate() + 1);
	}
	return out;
}
