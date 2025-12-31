"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

const PLAN_OPTIONS = ["standard", "premium", "ultra"];
const TERM_OPTIONS = [
  { label: "No expiry", value: "" },
  { label: "1 month", value: "1" },
  { label: "3 months", value: "3" },
  { label: "6 months", value: "6" },
  { label: "12 months", value: "12" },
  { label: "24 months", value: "24" },
  { label: "Custom end date", value: "custom" },
];

function toDateInputValue(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  // yyyy-mm-dd in local time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminSubscriptionsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Per-org draft settings for changes
  const [draft, setDraft] = useState({}); // { [orgId]: { plan, term, customEndDate, po, notes } }
  const [busyOrg, setBusyOrg] = useState(null);

  const load = async () => {
    setErr("");
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_org_subscription_overview");
    if (error) setErr(error.message);
    setRows(data || []);

    // initialize drafts (non-destructive)
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of data || []) {
        if (!next[r.organization_id]) {
          next[r.organization_id] = {
            plan: r.plan_code || "standard",
            term: "", // default "No expiry"
            customEndDate: toDateInputValue(r.ends_at),
            po: "",
            notes: "",
          };
        }
      }
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limitOf = (r, key) => (r?.limits && r.limits[key] != null ? r.limits[key] : "-");

  const updateDraft = (orgId, patch) => {
    setDraft((d) => ({
      ...d,
      [orgId]: { ...(d[orgId] || {}), ...patch },
    }));
  };

  const applyPlan = async (orgId) => {
    setErr("");
    setBusyOrg(orgId);

    const d = draft[orgId] || {};
    const plan = d.plan || "standard";

    const term =
      d.term === "custom"
        ? "custom"
        : d.term === ""
          ? ""
          : String(parseInt(d.term, 10));

    const p_term_months = term === "" || term === "custom" ? null : Number(term);

    // For custom end date, send a timestamptz-ish value. (Supabase will parse ISO.)
    const p_ends_at =
      term === "custom" && d.customEndDate
        ? new Date(`${d.customEndDate}T23:59:59`).toISOString()
        : null;

    const { error } = await supabase.rpc("admin_set_org_plan", {
      p_organization_id: orgId,
      p_plan_code: plan,
      p_term_months,
      p_ends_at,
      p_po_number: d.po || null,
      p_notes: d.notes || null,
    });

    setBusyOrg(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  };

  const cancelSubscription = async (orgId) => {
    setErr("");
    setBusyOrg(orgId);

    const d = draft[orgId] || {};
    const note = d.notes || "Cancelled via admin page";

    const { error } = await supabase.rpc("admin_cancel_org_subscription", {
      p_organization_id: orgId,
      p_notes: note,
    });

    setBusyOrg(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-lg font-semibold text-slate-100">Admin: Subscriptions</h1>
          <button className="btn btn-xs" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        {err ? <div className="text-sm text-red-300 mb-3">{err}</div> : null}

        {loading ? (
          <div className="text-slate-300/70 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[1120px]">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Current</th>
                  <th>Usage (used / limit)</th>
                  <th>Change</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const orgId = r.organization_id;
                  const d = draft[orgId] || {};
                  const isBusy = busyOrg === orgId;

                  return (
                    <tr key={orgId}>
                      <td>
                        <div className="font-medium text-slate-100">{r.organization_name}</div>
                        <div className="text-xs text-slate-300/70">{orgId}</div>
                      </td>

                      <td className="text-xs">
                        <div className="text-slate-100">
                          {r.plan_name || "-"}{" "}
                          <span className="text-slate-300/70">({r.plan_code || "-"})</span>
                        </div>
                        <div className="text-slate-300/70">Status: {r.status || "-"}</div>
                        <div className="text-slate-300/70">
                          Ends: {r.ends_at ? new Date(r.ends_at).toLocaleString() : "No expiry"}
                        </div>
                      </td>

                      <td className="text-xs text-slate-200">
                        <div>Projects: {r.used_projects} / {limitOf(r, "projects")}</div>
                        <div>Resources: {r.used_resources} / {limitOf(r, "resources")}</div>
                        <div>Holes: {r.used_holes} / {limitOf(r, "holes")}</div>
                        <div>Assets: {r.used_assets} / {limitOf(r, "assets")}</div>
                        <div>Vendors: {r.used_vendors} / {limitOf(r, "vendors")}</div>
                        <div>Plods: {r.used_plods} / {limitOf(r, "plods")}</div>
                      </td>

                      <td>
                        <div className="flex flex-col gap-2 min-w-[260px]">
                          <select
                            className="input input-sm"
                            value={d.plan || "standard"}
                            onChange={(e) => updateDraft(orgId, { plan: e.target.value })}
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>

                          <select
                            className="input input-sm"
                            value={d.term ?? ""}
                            onChange={(e) => updateDraft(orgId, { term: e.target.value })}
                          >
                            {TERM_OPTIONS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>

                          {d.term === "custom" ? (
                            <input
                              className="input input-sm"
                              type="date"
                              value={d.customEndDate || ""}
                              onChange={(e) => updateDraft(orgId, { customEndDate: e.target.value })}
                            />
                          ) : null}

                          <input
                            className="input input-sm"
                            placeholder="PO number (optional)"
                            value={d.po || ""}
                            onChange={(e) => updateDraft(orgId, { po: e.target.value })}
                          />

                          <input
                            className="input input-sm"
                            placeholder="Notes (optional)"
                            value={d.notes || ""}
                            onChange={(e) => updateDraft(orgId, { notes: e.target.value })}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => applyPlan(orgId)}
                            disabled={isBusy}
                          >
                            Apply
                          </button>

                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            onClick={() => cancelSubscription(orgId)}
                            disabled={isBusy || r.status !== "active"}
                            title={r.status !== "active" ? "No active subscription to cancel" : "Cancel active subscription"}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-sm text-slate-300/70 p-4">
                      No organizations found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}