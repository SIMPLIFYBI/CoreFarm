// filepath: c:\Users\james\supa-CoreYard\supa-coreyard\app\assets\components\HistoryTable.jsx
"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function HistoryTable({ TABLE_HEAD_ROW, TABLE_ROW }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseBrowser();
    setLoading(true);
    supabase
      .from("asset_history")
      .select("id, created_at, asset_id, user_id, action, details, assets(name), users(email)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setHistory(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Asset History</h2>
      </div>

      <div className="overflow-x-auto -mx-2 md:mx-0">
        <table className="w-full text-xs md:text-sm min-w-[900px]">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Asset</th>
              <th className="p-2 font-medium">User</th>
              <th className="p-2 font-medium">Action</th>
              <th className="p-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-300/70">
                  Loading...
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-300/70">
                  No history found.
                </td>
              </tr>
            ) : (
              history.map((row) => (
                <tr key={row.id} className={TABLE_ROW}>
                  <td className="p-2 whitespace-nowrap">{row.created_at?.slice(0, 10)}</td>
                  <td className="p-2">{row.assets?.name || row.asset_id}</td>
                  <td className="p-2">{row.users?.email || row.user_id}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">{row.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}