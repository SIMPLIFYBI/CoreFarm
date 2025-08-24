"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { TASK_TYPES } from "@/lib/taskTypes";
import { BarChart, DonutChart, TrendChart, LineChartX } from "@/app/components/Charts";

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
  const [orgId, setOrgId] = useState("");
  const [memberships, setMemberships] = useState([]);
  const [tab, setTab] = useState("dashboard"); // 'dashboard' | 'activity' | 'consumables'
  // Consumables report state
  const [consumableItems, setConsumableItems] = useState([]); // included items with counts
  const [consumableTrend, setConsumableTrend] = useState([]); // ordered over time
  const [consumableLoading, setConsumableLoading] = useState(false);

  // Filters (dashboard)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [types, setTypes] = useState(TASK_TYPES);

  // Data (dashboard)
  const [byType, setByType] = useState([]); // [{label, value, color}]
  const [trend, setTrend] = useState([]); // [{label: yyyy-mm-dd, value}]

  // Data (logging activity)
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
      // Load org memberships to scope queries
      const { data: ms } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(name)")
        .eq("user_id", userData?.user?.id);
      setMemberships(ms || []);
      if ((ms || []).length > 0) setOrgId(ms[0].organization_id);
      setLoading(false);
    })();
    return () => sub?.unsubscribe?.();
  }, [supabase]);

  // Load logging activity for user
  useEffect(() => {
    if (tab !== "activity" || !user) return;
    setActivityLoading(true);
    (async () => {
      const { data: rows, error } = await supabase
        .from("hole_task_progress")
        .select("id, hole_id, task_type, from_m, to_m, logged_on, holes(hole_id)")
        .eq("user_id", user.id)
        .order("logged_on", { ascending: false });
      setActivityRows(rows || []);
      setActivityLoading(false);
    })();
  }, [tab, user]);

  // Load consumables report data
  useEffect(() => {
    if (tab !== 'consumables' || !orgId) return;
    (async () => {
      setConsumableLoading(true);
      try {
        // Current included inventory
        const { data: inv } = await supabase
          .from('consumable_items')
          .select('key,label,count')
          .eq('organization_id', orgId)
          .eq('include_in_report', true)
          .order('label');
        setConsumableItems(inv || []);
        // Ordered trend: count quantity of items that have been ordered (po.status in ordered/received OR item.status in ordered/received)
        const { data: orderedItems } = await supabase
          .from('purchase_order_items')
          .select('created_at, quantity, status, item_key, label, po:purchase_orders(status, ordered_date)')
          .eq('organization_id', orgId);
        // Group by month for included items only where item has transitioned to ordered or received
        const monthMap = {};
        for (const row of orderedItems || []) {
          if (!inv?.some(i => i.key === row.item_key)) continue; // only included items
          const isOrdered = row.status === 'ordered' || row.status === 'received' || (row.po && (row.po.status === 'ordered' || row.po.status === 'received'));
          if (!isOrdered) continue;
          const dt = row.po?.ordered_date || row.created_at || new Date().toISOString();
          const month = (dt || '').slice(0,7); // YYYY-MM
          if (!month) continue;
          monthMap[month] = (monthMap[month] || 0) + (row.quantity || 0);
        }
        // Produce last 6 months timeline
        const now = new Date();
        const months = [];
        for (let i=5;i>=0;i--) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-i, 1));
          const m = d.toISOString().slice(0,7);
          months.push(m);
        }
        setConsumableTrend(months.map(m => ({ label: m, value: monthMap[m] || 0 })));
      } catch(e) {
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
        // Fetch holes for org to scope progress
        const { data: holes } = await supabase
          .from("holes")
          .select("id")
          .eq("organization_id", orgId);
        const holeIds = (holes || []).map((h) => h.id);
        if (holeIds.length === 0) {
          setByType([]);
          setTrend([]);
          setLoading(false);
          return;
        }

        // Fetch progress rows for selected types and date range
        let q = supabase
          .from("hole_task_progress")
          .select("hole_id, task_type, from_m, to_m, logged_on")
          .in("hole_id", holeIds)
          .gte("logged_on", fromDate)
          .lte("logged_on", toDate);
        if ((types || []).length > 0 && types.length < TASK_TYPES.length) {
          q = q.in("task_type", types);
        }
        const { data: rows, error } = await q;
        if (error) throw error;

        // Aggregate meters by task type
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

        // Build per-day trend for total meters
        const byDate = {};
        for (const r of rows || []) {
          const m = Number(r.to_m) - Number(r.from_m);
          if (!Number.isFinite(m) || m <= 0) continue;
          const day = String(r.logged_on);
          byDate[day] = (byDate[day] || 0) + m;
        }
        const days = eachDay(fromDate, toDate);
        const points = days.map((d) => ({ label: d, value: byDate[d] || 0 }));
        setTrend(points);
      } catch (e) {
        console.error(e);
        setByType([]);
        setTrend([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, user, fromDate, toDate, types, supabase]);

  const toggleType = (t) => {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Report</h1>
      <div className="mb-6 flex gap-2 border-b">
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "dashboard" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "activity" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("activity")}
        >
          Logging Activity
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "consumables" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("consumables")}
        >
          Consumables
        </button>
      </div>

      {tab === "dashboard" && (
        <>
          {/* Filters */}
          <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Task types</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleType(opt.key)}
                    className={`px-2.5 py-1.5 rounded-full text-xs border flex items-center gap-2 ${
                      types.includes(opt.key) ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: opt.color }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Kpi title="Total meters" value={sum(byType.map((d) => d.value))} suffix=" m" />
            <Kpi title="Active task types" value={byType.filter((d) => d.value > 0).length} />
            <Kpi title="Days logged" value={trend.filter((p) => p.value > 0).length} />
            <Kpi title="Avg m/day" value={avg(trend.map((p) => p.value))} suffix=" m" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-4">
              <div className="text-sm font-medium mb-2">Meters by task type</div>
              <BarChart data={byType} />
            </div>
            <div className="card p-4">
              <div className="text-sm font-medium mb-2">Distribution</div>
              <DonutChart data={byType} />
            </div>
            <div className="card p-4 md:col-span-2">
              <div className="text-sm font-medium mb-2">Meters over time</div>
              <LineChartX points={trend} />
            </div>
          </div>

          {loading && <div className="mt-4 text-sm text-gray-500">Loading…</div>}
          {!loading && byType.length === 0 && (
            <div className="mt-4 text-sm text-gray-500">No data in the selected range.</div>
          )}
        </>
      )}

      {tab === "activity" && (
        <div className="card p-4">
          <div className="text-sm font-medium mb-2">My Logging Activity</div>
          {activityLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : activityRows.length === 0 ? (
            <div className="text-sm text-gray-500">No logging activity found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-[10px] border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-1 border">Hole</th>
                    <th className="p-1 border">Task</th>
                    <th className="p-1 border">Interval (m)</th>
                    <th className="p-1 border">Date</th>
                    <th className="p-1 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.id}>
                      <td className="p-1 border">{row.holes?.hole_id || row.hole_id}</td>
                      <td className="p-1 border">{labelForTask(row.task_type)}</td>
                      <td className="p-1 border">{row.from_m}–{row.to_m}</td>
                      <td className="p-1 border">{row.logged_on}</td>
                      <td className="p-1 border whitespace-nowrap">
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
                                // Save edit
                                const { error } = await supabase
                                  .from("hole_task_progress")
                                  .update({
                                    from_m: editRow.from_m,
                                    to_m: editRow.to_m,
                                    logged_on: editRow.logged_on,
                                  })
                                  .eq("id", row.id);
                                setEditRowId(null);
                                setEditRow({});
                                // Reload
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
                              onClick={() => { setEditRowId(row.id); setEditRow({ from_m: row.from_m, to_m: row.to_m, logged_on: row.logged_on }); }}
                            >Amend</button>
                            <button
                              className="btn btn-danger btn-xs px-2 py-0"
                              onClick={async () => {
                                // Delete entry
                                const { error } = await supabase
                                  .from("hole_task_progress")
                                  .delete()
                                  .eq("id", row.id);
                                // Reload
                                const { data: rows } = await supabase
                                  .from("hole_task_progress")
                                  .select("id, hole_id, task_type, from_m, to_m, logged_on, holes(hole_id)")
                                  .eq("user_id", user.id)
                                  .order("logged_on", { ascending: false });
                                setActivityRows(rows || []);
                              }}
                            >Delete</button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi title="Tracked items" value={consumableItems.length} />
            <Kpi title="Total on hand" value={consumableItems.reduce((a,b)=>a+(b.count||0),0)} />
            <Kpi title="Avg / item" value={consumableItems.length ? consumableItems.reduce((a,b)=>a+(b.count||0),0)/consumableItems.length : 0} />
            <Kpi title="Months shown" value={consumableTrend.length} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-4">
              <div className="text-sm font-medium mb-2">Current Inventory (Included)</div>
              {consumableLoading ? <div className="text-xs text-gray-500">Loading…</div> : consumableItems.length === 0 ? (
                <div className="text-xs text-gray-500">No consumable items selected for report. Use the checkbox on the Inventory page.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="p-2">Item</th>
                        <th className="p-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumableItems.map(it => (
                        <tr key={it.key} className="border-b last:border-b-0">
                          <td className="p-2">{it.label}</td>
                          <td className="p-2 text-right">{it.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card p-4">
              <div className="text-sm font-medium mb-2">Ordered Quantity (last 6 months)</div>
              {consumableTrend.length === 0 ? (
                <div className="text-xs text-gray-500">No ordered items yet.</div>
              ) : (
                <LineChartX points={consumableTrend.map(p => ({ label: p.label, value: p.value }))} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value, suffix }) {
  const formatted = typeof value === "number"
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
    : (value ?? 0);
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">
        {formatted}
        {suffix ? <span className="text-sm text-gray-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

function labelForTask(t) {
  return (
    {
      orientation: "Orientation",
      magnetic_susceptibility: "Magnetic Susceptibility",
      whole_core_sampling: "Whole-core Sampling",
      cutting: "Cutting",
      rqd: "RQD",
      specific_gravity: "Specific Gravity",
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

function sum(arr) {
  return Math.round((arr.reduce((a, b) => a + (Number(b) || 0), 0) + Number.EPSILON) * 10) / 10;
}
function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(((arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length) + Number.EPSILON) * 10) / 10;
}
