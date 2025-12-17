import React from "react";
import { Spinner } from "./Spinner";

export function HistoryTable({
  plods = [],
  plodsLoading = false,
  dateRange,
  onDateChange,
  onRefresh,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="input input-sm !w-auto"
          value={dateRange?.from || ""}
          onChange={(e) => onDateChange?.("from", e.target.value)}
        />
        <input
          type="date"
          className="input input-sm !w-auto"
          value={dateRange?.to || ""}
          onChange={(e) => onDateChange?.("to", e.target.value)}
        />
        <button onClick={onRefresh} className="btn">
          Refresh
        </button>
      </div>

      <div className="table-container p-3">
        {plodsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Spinner size={16} /> Loading…
          </div>
        ) : plods.length === 0 ? (
          <div className="text-sm text-slate-300">No plods in range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {plods.map((p) => (
                  <tr key={p.id}>
                    <td>{p.shift_date}</td>
                    <td>{p.vendor_name ?? p.vendor_id}</td>
                    <td>{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}