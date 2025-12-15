import React from "react";
import { Spinner } from "./Spinner";

export function HistoryTable({
  plods = [],
  plodsLoading = false,
  dateRange,
  onDateChange,
  onRefresh,
  onNew,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="border rounded p-2"
          value={dateRange?.from || ""}
          onChange={(e) => onDateChange?.("from", e.target.value)}
        />
        <input
          type="date"
          className="border rounded p-2"
          value={dateRange?.to || ""}
          onChange={(e) => onDateChange?.("to", e.target.value)}
        />
        <button onClick={onRefresh} className="px-3 py-2 rounded bg-gray-100 border">
          Refresh
        </button>
        <button onClick={onNew} className="px-3 py-2 rounded bg-indigo-600 text-white">
          New Plod
        </button>
      </div>

      <div className="border rounded p-3 bg-white">
        {plodsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner size={16} /> Loading…
          </div>
        ) : plods.length === 0 ? (
          <div className="text-sm text-gray-500">No plods in range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {plods.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.shift_date}</td>
                    <td className="py-2 pr-4">{p.vendor_name ?? p.vendor_id}</td>
                    <td className="py-2 pr-4">{p.notes}</td>
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