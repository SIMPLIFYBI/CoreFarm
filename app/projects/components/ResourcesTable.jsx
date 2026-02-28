"use client";

import { EditIconButton, DeleteIconButton } from "@/app/components/ActionIconButton";

export default function ResourcesTable({ loading, resources, onEdit, onDelete, TABLE_HEAD_ROW, TABLE_ROW }) {
  return (
    <div className="card p-4">
      {loading ? (
        <div className="text-sm text-slate-300/70">Loading…</div>
      ) : resources.length === 0 ? (
        <div className="text-sm text-slate-300/70">No resources found.</div>
      ) : (
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[820px]">
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Resource Type</th>
                <th className="p-2 font-medium">Vendor</th>
                <th className="p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2">{r.resource_type || "—"}</td>
                  <td className="p-2">{r.vendor?.name || "—"}</td>
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <EditIconButton onClick={() => onEdit(r)} />
                      <DeleteIconButton onClick={() => onDelete(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}