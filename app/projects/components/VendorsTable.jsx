"use client";

import React from "react";

export default function VendorsTable({ vendors }) {
  return (
    <div className="card p-4">
      <div className="overflow-x-auto -mx-2 md:mx-0">
        <table className="w-full text-xs md:text-sm min-w-[720px]">
          <thead>
            <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
              <th className="p-2 font-medium">Vendor</th>
              <th className="p-2 font-medium">Contact</th>
              <th className="p-2 font-medium">Connected</th>
            </tr>
          </thead>
          <tbody>
            {(vendors || []).map((v) => (
              <tr key={v.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                <td className="p-2 font-medium">{v.name || v.vendor_name || "—"}</td>
                <td className="p-2">{v.email || v.phone || "—"}</td>
                <td className="p-2">{v.linked_organization_id ? "Yes" : "No"}</td>
              </tr>
            ))}
            {(!vendors || vendors.length === 0) && (
              <tr>
                <td className="p-2 text-slate-400" colSpan={3}>
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}