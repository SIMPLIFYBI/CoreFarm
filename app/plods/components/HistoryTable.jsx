import React from "react";
import { Spinner } from "./Spinner";

function StatusBadge({ status }) {
  const value = (status || "submitted").toLowerCase();
  const classes =
    value === "approved"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
      : value === "rejected"
      ? "bg-rose-500/15 text-rose-200 border-rose-500/25"
      : "bg-amber-500/15 text-amber-200 border-amber-500/25";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${classes}`}>
      {value}
    </span>
  );
}

function formatPlodForDate(row) {
  const v = row.shift_date || row.started_at;
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatSubmitter(row) {
  if (row.submitted_by_profile?.display_name) return row.submitted_by_profile.display_name;
  if (row.submitted_by_profile?.full_name) return row.submitted_by_profile.full_name;
  if (row.submitted_by_profile?.email) return row.submitted_by_profile.email;
  if (row.submitted_by) return String(row.submitted_by).slice(0, 8);
  return "—";
}

export function HistoryTable({
  plods = [],
  plodsLoading = false,
  plodScope = "my",
  onPlodScopeChange,
  dateRange,
  onDateChange,
  onSelectPlod,
}) {
  return (
    <div className="space-y-4">
      <section className="glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-4 overflow-hidden">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_repeat(2,minmax(180px,220px))] md:items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">History scope</div>
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-slate-900/40 p-1 gap-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-medium transition-base ${plodScope === "my" ? "bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/10"}`}
                onClick={() => onPlodScopeChange?.("my")}
              >
                My Plods
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-medium transition-base ${plodScope === "client" ? "bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/10"}`}
                onClick={() => onPlodScopeChange?.("client")}
              >
                Client Plods
              </button>
            </div>
          </div>

          <label className="block text-xs text-slate-300">
            Date From
            <input
              type="date"
              className="input mt-1 h-10 text-[11px]"
              value={dateRange?.from || ""}
              onChange={(e) => onDateChange?.("from", e.target.value)}
            />
          </label>

          <label className="block text-xs text-slate-300">
            Date To
            <input
              type="date"
              className="input mt-1 h-10 text-[11px]"
              value={dateRange?.to || ""}
              onChange={(e) => onDateChange?.("to", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="table-container p-3">
        {plodsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Spinner size={16} /> Loading…
          </div>
        ) : plods.length === 0 ? (
          <div className="text-sm text-slate-300">
            {plodScope === "client" ? "No client plods match the current filters." : "No plods match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Plod Date</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Submitter</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plods.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    onClick={() => onSelectPlod?.(p)}
                  >
                    <td>{formatPlodForDate(p)}</td>
                    <td>{p.plod_types?.name ?? p.plod_type ?? p.plod_type_id ?? "—"}</td>
                    <td>{p.vendors?.name ?? p.vendor_name ?? p.vendor_id ?? "—"}</td>
                    <td>{formatSubmitter(p)}</td>
                    <td>
                      <StatusBadge status={p.approval_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}