"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { TASK_TYPES } from "@/lib/taskTypes";
import { BarChart, DonutChart, StackedColumnChart } from "@/app/components/Charts";
import { DashboardTabs } from "./components/DashboardTabs";
import { DashboardFilters } from "./components/DashboardFilters";
import { DashboardKpis } from "./components/DashboardKpis";

const COLORS = [
	"#4f46e5",
	"#06b6d4",
	"#22c55e",
	"#f59e0b",
	"#ef4444",
	"#a855f7",
];

export default function UserDashboardPage() {
	const supabase = supabaseBrowser();
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const { orgId } = useOrg();
	const [tab, setTab] = useState("dashboard"); // 'dashboard' | 'activity' | 'consumables'
	const [consumableItems, setConsumableItems] = useState([]);
	const [consumableTrend, setConsumableTrend] = useState([]);
	const [consumableLoading, setConsumableLoading] = useState(false);

	const [fromDate, setFromDate] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 29);
		return d.toISOString().slice(0, 10);
	});
	const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [types, setTypes] = useState(TASK_TYPES);
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
				const { data: inv } = await supabase
					.from("consumable_items")
					.select("id,key,label,count,reorder_value,cost_per_unit,unit_size,include_in_report")
					.eq("organization_id", orgId)
					.order("label");
				const allItems = inv || [];
				const lowReorder = allItems.filter((it) => {
					const rv = it.reorder_value || 0;
					if (rv <= 0) return false;
					const c = it.count || 0;
					if (c <= rv) return true;
					if (c <= rv * 1.5) return true;
					return false;
				});
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

	const typeOptions = useMemo(
		() => TASK_TYPES.map((t, i) => ({ key: t, label: labelForTask(t), color: COLORS[i % COLORS.length] })),
		[]
	);

	useEffect(() => {
		if (!orgId || !user) return;
		(async () => {
			setLoading(true);
			try {
				const { data: holes } = await supabase.from("holes").select("id").eq("organization_id", orgId);
				const holeIds = (holes || []).map((h) => h.id);
				if (holeIds.length === 0) {
					setByType([]);
					setTrend([]);
					setUnloggedMeters(0);
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
				if ((types || []).length > 0 && types.length < TASK_TYPES.length) q = q.in("task_type", types);
				const { data: rows, error } = await q;
				if (error) throw error;

				const metersByType = {};
				for (const r of rows || []) {
					const m = Number(r.to_m) - Number(r.from_m);
					if (!Number.isFinite(m) || m <= 0) continue;
					metersByType[r.task_type] = (metersByType[r.task_type] || 0) + m;
				}
				const pie = TASK_TYPES.map((t, i) => ({
					key: t,
					label: labelForTask(t),
					value: metersByType[t] || 0,
					color: COLORS[i % COLORS.length],
				})).filter((d) => types.includes(d.key));
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
					const segments = TASK_TYPES.filter((t) => types.includes(t))
						.map((t, idx) => ({
							key: t,
							label: labelForTask(t),
							color: COLORS[idx % COLORS.length],
							value: taskMap[t] || 0,
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
	}, [orgId, user, fromDate, toDate, types, supabase]);

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

	const allSelected = types.length === TASK_TYPES.length;
	const selectedLabels = typeOptions.filter((o) => types.includes(o.key)).map((o) => o.label);
	const buttonLabel = allSelected
		? `All Tasks (${types.length})`
		: selectedLabels.slice(0, 3).join(", ") + (selectedLabels.length > 3 ? ` +${selectedLabels.length - 3}` : "");

	return (
		<div className="max-w-6xl mx-auto p-4 md:p-6">
			<h1 className="text-2xl font-semibold mb-4 text-slate-50">Report</h1>
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
						allTaskTypes={TASK_TYPES}
						typeOptions={typeOptions}
						taskSelectOpen={taskSelectOpen}
						setTaskSelectOpen={setTaskSelectOpen}
						buttonLabel={buttonLabel}
						selectedLabels={selectedLabels}
						toggleType={toggleType}
					/>

					<DashboardKpis byType={byType} orientationAvg={orientationAvg} unloggedMeters={unloggedMeters} trend={trend} />

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="card p-4">
							<div className="text-sm font-medium mb-2 text-slate-100">Meters by task type</div>
							<BarChart data={byType} />
						</div>
						<div className="card p-4">
							<div className="text-sm font-medium mb-2 text-slate-100">Distribution</div>
							<DonutChart data={byType} />
						</div>
						<div className="card p-4 md:col-span-2">
							<div className="text-sm font-medium mb-2 text-slate-100">Daily production (last 14 days)</div>
							<StackedColumnChart data={stacked14} height={160} fullBleed />
						</div>
					</div>

					{loading && <div className="mt-4 text-sm text-slate-400">Loadingâ€¦</div>}
					{!loading && byType.length === 0 && <div className="mt-4 text-sm text-slate-400">No data in the selected range.</div>}
				</>
			)}

			{tab === "activity" && (
				<div className="card p-4">
					<div className="text-sm font-medium mb-2 text-slate-100">My Logging Activity</div>
					{activityLoading ? (
						<div className="text-sm text-slate-400">Loadingâ€¦</div>
					) : activityRows.length === 0 ? (
						<div className="text-sm text-slate-400">No logging activity found.</div>
					) : (
						<div className="overflow-x-auto">
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
											<td className="p-1 border border-slate-800/80">{labelForTask(row.task_type)}</td>
											<td className="p-1 border border-slate-800/80">{row.from_m}â€“{row.to_m}</td>
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
				</div>
			)}

			{tab === "consumables" && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-6">
						<div className="card p-4">
							<div className="text-sm font-medium mb-2 text-slate-100">Low / Reorder Inventory</div>
							{consumableLoading ? (
								<div className="text-xs text-slate-400">Loadingâ€¦</div>
							) : consumableItems.length === 0 ? (
								<div className="text-xs text-slate-400">No items currently Low or at Reorder threshold.</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-xs md:text-sm">
										<thead>
											<tr className="text-left bg-slate-900/80 text-slate-100">
												<th className="p-2">Item</th>
												<th className="p-2 text-right">Count</th>
												<th className="p-2 text-right">Status</th>
											</tr>
										</thead>
										<tbody>
											{consumableItems.map((it) => {
												const rv = it.reorder_value || 0;
												const c = it.count || 0;
												let cls = "badge-gray";
												let txt = "â€”";
												if (rv > 0) {
													if (c <= rv) {
														cls = "badge-red";
														txt = "Reorder";
													} else if (c <= rv * 1.5) {
														cls = "badge-amber";
														txt = "Low";
													} else {
														cls = "badge-green";
														txt = "OK";
													}
												}
												return (
													<tr key={it.key} className="border-b border-slate-800/80 last:border-b-0 text-slate-100">
														<td className="p-2">{it.label}</td>
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
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function labelForTask(t) {
	return (
		{
			orientation: "Orientation",
			magnetic_susceptibility: "Mag Sus",
			whole_core_sampling: "WC Samp",
			cutting: "Cutting",
			rqd: "RQD",
			specific_gravity: "SG",
		}[t] || t
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
