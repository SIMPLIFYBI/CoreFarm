"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { TASK_TYPES } from "@/lib/taskTypes";
import { BarChart, DonutChart, TrendChart } from "@/app/components/Charts";

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

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [types, setTypes] = useState(TASK_TYPES);

  // Data
  const [byType, setByType] = useState([]); // [{label, value, color}]
  const [trend, setTrend] = useState([]); // [{label: yyyy-mm-dd, value}]

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
      <h1 className="text-2xl font-semibold mb-4">My Dashboard</h1>

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
          <TrendChart points={trend} />
        </div>
      </div>

      {loading && <div className="mt-4 text-sm text-gray-500">Loading…</div>}
      {!loading && byType.length === 0 && (
        <div className="mt-4 text-sm text-gray-500">No data in the selected range.</div>
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
