"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

function formatDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function toHours(startedAt, finishedAt) {
  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  const finish = finishedAt ? new Date(finishedAt).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish <= start) return 0;
  return (finish - start) / (1000 * 60 * 60);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ActivityPage() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [loading, setLoading] = useState(true);
  const [plodRows, setPlodRows] = useState([]);
  const [expandedPlods, setExpandedPlods] = useState({});

  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendorFilter, setVendorFilter] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [query, setQuery] = useState("");

  const [orgCurrency, setOrgCurrency] = useState("");
  const [orgTaxRate, setOrgTaxRate] = useState(null); // percent, nullable
  const [includeTax, setIncludeTax] = useState(false);

  const loadActivity = async () => {
    if (!orgId) {
      setPlodRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let request = supabase
        .from("plods")
        .select(
          `
          id,
          shift_date,
          notes,
          vendors:vendor_id(name),
          plod_activities(
            id,
            started_at,
            finished_at,
            notes,
            activity_types:activity_type_id(activity_type),
            holes:hole_id(hole_id)
          )
        `
        )
        .eq("organization_id", orgId)
        .order("shift_date", { ascending: false })
        .limit(500);

      if (dateFrom) request = request.gte("shift_date", dateFrom);
      if (dateTo) request = request.lte("shift_date", dateTo);

      const { data, error } = await request;
      if (error) throw error;

      const plodIds = (data || []).map((plod) => plod.id);
      const pricingByPlod = new Map();
      const pricingLinesByActivityId = new Map();

      if (plodIds.length) {
        const { data: pricingData, error: pricingError } = await supabase
          .from("v_plod_latest_pricing")
          .select("plod_id,snapshot_id,total_ex_tax,total_inc_tax,total_tax,currency,tax_rate")
          .in("plod_id", plodIds);

        if (pricingError) throw pricingError;
        for (const pricingRow of pricingData || []) {
          pricingByPlod.set(pricingRow.plod_id, pricingRow);
        }

        const snapshotIds = (pricingData || [])
          .map((row) => row.snapshot_id)
          .filter(Boolean);

        if (snapshotIds.length) {
          const { data: lineData, error: lineError } = await supabase
            .from("plod_pricing_snapshot_lines")
            .select("snapshot_id,source_id,line_kind,line_ex_tax,line_inc_tax")
            .eq("line_kind", "activity")
            .in("snapshot_id", snapshotIds);

          if (lineError) throw lineError;

          for (const line of lineData || []) {
            if (line.source_id) pricingLinesByActivityId.set(line.source_id, line);
          }
        }
      }

      const normalizedPlods = [];
      for (const plod of data || []) {
        const pricing = pricingByPlod.get(plod.id);
        const activities = [];

        for (const activity of plod.plod_activities || []) {
          const durationHours = toHours(activity.started_at, activity.finished_at);
          const line = pricingLinesByActivityId.get(activity.id);

          activities.push({
            id: activity.id,
            asset: activity.holes?.hole_id || "Unassigned",
            activity_type: activity.activity_types?.activity_type || "Unknown",
            started_at: activity.started_at,
            finished_at: activity.finished_at,
            duration_hours: durationHours,
            line_ex_tax: line?.line_ex_tax ?? null,
            line_inc_tax: line?.line_inc_tax ?? null,
            notes: activity.notes || plod.notes || "",
          });
        }

        normalizedPlods.push({
          id: plod.id,
          shift_date: plod.shift_date,
          vendor: plod.vendors?.name || "Unassigned",
          notes: plod.notes || "",
          total_ex_tax: pricing?.total_ex_tax ?? null,
          total_inc_tax: pricing?.total_inc_tax ?? null,
          activities,
        });
      }

      normalizedPlods.sort((a, b) => {
        const aTime = new Date(a.shift_date || "1970-01-01").getTime();
        const bTime = new Date(b.shift_date || "1970-01-01").getTime();
        return bTime - aTime;
      });

      setPlodRows(normalizedPlods);
    } catch (error) {
      toast.error(error?.message || "Failed to load activity data");
      setPlodRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, dateFrom, dateTo]);

  useEffect(() => {
    if (!orgId) {
      setOrgCurrency("");
      setOrgTaxRate(null);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("currency, tax_rate")
        .eq("id", orgId)
        .maybeSingle();

      if (error) return;
      setOrgCurrency((data?.currency || "").toUpperCase());
      setOrgTaxRate(
        data?.tax_rate === null || data?.tax_rate === undefined
          ? null
          : Number(data.tax_rate)
      );
    })();
  }, [orgId, supabase]);

  const allActivities = useMemo(() => plodRows.flatMap((plod) => plod.activities), [plodRows]);

  const vendorOptions = useMemo(
    () => Array.from(new Set(plodRows.map((row) => row.vendor))).sort((a, b) => a.localeCompare(b)),
    [plodRows]
  );

  const assetOptions = useMemo(
    () => Array.from(new Set(allActivities.map((row) => row.asset))).sort((a, b) => a.localeCompare(b)),
    [allActivities]
  );

  const activityOptions = useMemo(
    () => Array.from(new Set(allActivities.map((row) => row.activity_type))).sort((a, b) => a.localeCompare(b)),
    [allActivities]
  );

  const filteredPlods = useMemo(() => {
    const search = query.trim().toLowerCase();
    return plodRows
      .map((plod) => {
        if (vendorFilter && plod.vendor !== vendorFilter) return null;

        const filteredActivities = plod.activities.filter((row) => {
          if (assetFilter && row.asset !== assetFilter) return false;
          if (activityFilter && row.activity_type !== activityFilter) return false;
          if (!search) return true;

          return [
            plod.vendor,
            plod.shift_date,
            plod.notes,
            row.asset,
            row.activity_type,
            row.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search);
        });

        if (filteredActivities.length === 0) return null;
        return {
          ...plod,
          filteredActivities,
        };
      })
      .filter(Boolean);
  }, [plodRows, vendorFilter, assetFilter, activityFilter, query]);

  const filteredRows = useMemo(
    () => filteredPlods.flatMap((plod) => plod.filteredActivities),
    [filteredPlods]
  );

  const totalHours = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.duration_hours, 0),
    [filteredRows]
  );

  const uniqueAssets = useMemo(() => new Set(filteredRows.map((row) => row.asset)).size, [filteredRows]);

  const getPlodCostExTax = (plod) => {
    if (plod.total_ex_tax === null || plod.total_ex_tax === undefined) return null;
    const n = Number(plod.total_ex_tax);
    return Number.isFinite(n) ? n : null;
  };

  const getPlodCostIncTax = (plod) => {
    const exTax = getPlodCostExTax(plod);
    if (exTax === null) return null;

    if (plod.total_inc_tax !== null && plod.total_inc_tax !== undefined) {
      const direct = Number(plod.total_inc_tax);
      if (Number.isFinite(direct)) return direct;
    }

    const tax = Number(orgTaxRate);
    if (!Number.isFinite(tax) || tax <= 0) return exTax;
    return exTax * (1 + tax / 100);
  };

  const formatMoney = (value) => {
    if (value === null || value === undefined) return "—";
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    if (!orgCurrency) return safe.toFixed(2);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: orgCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safe);
    } catch {
      return safe.toFixed(2);
    }
  };

  const exportCsv = () => {
    if (!filteredRows.length) {
      toast.error("No rows to export");
      return;
    }

    const headers = [
      "Shift Date",
      "Vendor",
      "Asset",
      "Activity",
      "Started",
      "Finished",
      "Duration Hours",
      "Cost Ex Tax",
      "Cost Inc Tax",
      "Notes",
    ];

    const lines = filteredPlods.flatMap((plod) =>
      plod.filteredActivities.map((row) => [
        plod.shift_date,
        plod.vendor,
        row.asset,
        row.activity_type,
        row.started_at || "",
        row.finished_at || "",
        row.duration_hours.toFixed(2),
        row.line_ex_tax == null ? "" : Number(row.line_ex_tax).toFixed(2),
        row.line_inc_tax == null ? "" : Number(row.line_inc_tax).toFixed(2),
        row.notes,
      ])
    );

    const csv = [headers, ...lines]
      .map((line) => line.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-plod-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setVendorFilter("");
    setAssetFilter("");
    setActivityFilter("");
    setQuery("");
  };

  const displayedTotalCost = useMemo(
    () => {
      const exTotal = filteredPlods.reduce((sum, plod) => {
        const value = Number(plod.total_ex_tax);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      const incTotal = filteredPlods.reduce((sum, plod) => {
        const value = Number(plod.total_inc_tax);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      return includeTax ? incTotal : exTotal;
    },
    [filteredPlods, includeTax]
  );

  const toggleExpanded = (plodId) => {
    setExpandedPlods((prev) => ({ ...prev, [plodId]: !prev[plodId] }));
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
      <section className="card p-4 md:p-5">
        <h1 className="text-2xl font-semibold text-slate-100">Activity</h1>
        <p className="text-sm text-slate-300 mt-1">
          Central place to view and export operational data. Starting with PLOD activity.
        </p>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <label className="text-xs text-slate-300 xl:col-span-1">
            Date From
            <input className="input mt-1" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="text-xs text-slate-300 xl:col-span-1">
            Date To
            <input className="input mt-1" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="text-xs text-slate-300 xl:col-span-1">
            Vendor
            <select className="select-gradient-sm mt-1" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
              <option value="">All vendors</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-300 xl:col-span-1">
            Asset
            <select className="select-gradient-sm mt-1" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}>
              <option value="">All assets</option>
              {assetOptions.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-300 xl:col-span-1">
            Activity
            <select className="select-gradient-sm mt-1" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
              <option value="">All activities</option>
              {activityOptions.map((activity) => (
                <option key={activity} value={activity}>
                  {activity}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-300 xl:col-span-1">
            Search
            <input
              className="input mt-1"
              type="text"
              placeholder="Vendor, asset, notes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-300">
            Showing <span className="text-slate-100 font-medium">{filteredRows.length}</span> rows
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-3d-glass" onClick={clearFilters}>
              Clear filters
            </button>
            <button type="button" className="btn btn-3d-primary" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Rows</div>
          <div className="text-2xl font-semibold">{filteredRows.length}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Total Hours</div>
          <div className="text-2xl font-semibold">{totalHours.toFixed(1)}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Assets</div>
          <div className="text-2xl font-semibold">{uniqueAssets}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4 md:col-span-3">
          <div className="text-xs text-slate-300">{includeTax ? "Total Cost (Inc Tax)" : "Total Cost (Ex Tax)"}</div>
          <div className="text-2xl font-semibold">{formatMoney(displayedTotalCost)}</div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Shift Date</th>
                <th>Vendor</th>
                <th>Activities</th>
                <th>Cost Ex Tax</th>
                <th>Cost Inc Tax</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-300 py-8">
                    Loading activity…
                  </td>
                </tr>
              ) : filteredPlods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-300 py-8">
                    No activity rows match your filters.
                  </td>
                </tr>
              ) : (
                filteredPlods.map((plod) => {
                  const expanded = !!expandedPlods[plod.id];
                  return (
                    <>
                      <tr key={plod.id} className="cursor-pointer" onClick={() => toggleExpanded(plod.id)}>
                        <td>
                          <button
                            type="button"
                            className="btn btn-3d-glass btn-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(plod.id);
                            }}
                          >
                            {expanded ? "−" : "+"}
                          </button>
                        </td>
                        <td>{plod.shift_date}</td>
                        <td>{plod.vendor}</td>
                        <td>{plod.filteredActivities.length}</td>
                        <td>{formatMoney(getPlodCostExTax(plod))}</td>
                        <td>{formatMoney(getPlodCostIncTax(plod))}</td>
                        <td className="max-w-[260px] truncate" title={plod.notes || ""}>
                          {plod.notes || "—"}
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${plod.id}-details`}>
                          <td colSpan={7} className="p-0">
                            <div className="p-3">
                              <div className="table-container">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Activity</th>
                                      <th>Asset</th>
                                      <th>Started</th>
                                      <th>Finished</th>
                                      <th>Hours</th>
                                      <th>Item Ex Tax</th>
                                      <th>Item Inc Tax</th>
                                      <th>Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {plod.filteredActivities.map((row) => (
                                      <tr key={row.id}>
                                        <td>{row.activity_type}</td>
                                        <td>{row.asset}</td>
                                        <td>{formatDateTime(row.started_at)}</td>
                                        <td>{formatDateTime(row.finished_at)}</td>
                                        <td>{row.duration_hours.toFixed(2)}</td>
                                        <td>{formatMoney(row.line_ex_tax)}</td>
                                        <td>{formatMoney(row.line_inc_tax)}</td>
                                        <td className="max-w-[260px] truncate" title={row.notes || ""}>
                                          {row.notes || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex items-center gap-2">
        <span className="text-xs text-slate-300">
          {orgCurrency || "Currency not set"}
          {orgTaxRate != null ? ` • Tax ${Number(orgTaxRate).toFixed(2)}%` : " • Tax not set"}
        </span>
        <button
          type="button"
          className={`btn btn-xs ${includeTax ? "btn-3d-primary" : "btn-3d-glass"}`}
          onClick={() => setIncludeTax((v) => !v)}
          title="Toggle tax-inclusive totals"
        >
          {includeTax ? "Tax Inclusive" : "Tax Exclusive"}
        </button>
      </section>
    </div>
  );
}
