"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";

function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(v);
}

export default function ContractDetailsModal({ contract, orgId, onClose, onSave, onDelete }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const isOwner = orgId && contract?.client_organization_id === orgId;

  const [mode, setMode] = useState("view"); // 'view' | 'edit'
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: contract?.name || "",
    status: contract?.status || "active",
    contract_number: contract?.contract_number || "",
  });

  // Activities assignment state
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [assigning, setAssigning] = useState(false);

  // keep form in sync if you open different contracts without unmounting
  useEffect(() => {
    setForm({
      name: contract?.name || "",
      status: contract?.status || "active",
      contract_number: contract?.contract_number || "",
    });
    setMode("view");
  }, [contract?.id]);

  const loadActivities = async () => {
    if (!contract?.id) return;
    setActivityLoading(true);
    try {
      // 1) assigned rows (both parties can read)
      const assignedRes = await supabase
        .from("contract_activity_types")
        .select("activity_type_id,is_enabled")
        .eq("contract_id", contract.id);

      if (assignedRes.error) throw assignedRes.error;

      const enabledIds = new Set(
        (assignedRes.data || []).filter((r) => r.is_enabled).map((r) => r.activity_type_id)
      );
      setAssignedIds(enabledIds);

      // 2) activity type catalog
      // Owner: show full org catalog (checkbox list)
      // Vendor: show only assigned activity types (read-only list)
      if (isOwner) {
        const atRes = await supabase
          .from("plod_activity_types")
          .select('id,activity_type,description,billable,rate,rate_period,organization_id')
          .eq("organization_id", orgId)
          .order("activity_type", { ascending: true });

        if (atRes.error) throw atRes.error;
        setActivityTypes(atRes.data || []);
      } else {
        const ids = Array.from(enabledIds);
        if (ids.length === 0) {
          setActivityTypes([]);
        } else {
          const atRes = await supabase
            .from("plod_activity_types")
            .select('id,activity_type,description,billable,rate,rate_period,organization_id')
            .in("id", ids)
            .order("activity_type", { ascending: true });

          if (atRes.error) throw atRes.error;
          setActivityTypes(atRes.data || []);
        }
      }
    } catch (e) {
      console.error("load contract activities", e);
      toast.error(e?.message || "Failed to load contract activities");
      setActivityTypes([]);
      setAssignedIds(new Set());
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id, isOwner, orgId]);

  const setAssigned = (next) => setAssignedIds(new Set(next));

  const toggleAssigned = async (activityTypeId, checked) => {
    if (!isOwner) return;
    if (!contract?.id) return;

    setAssigning(true);
    try {
      if (checked) {
        const { error } = await supabase
          .from("contract_activity_types")
          .upsert(
            { contract_id: contract.id, activity_type_id: activityTypeId, is_enabled: true },
            { onConflict: "contract_id,activity_type_id" }
          );

        if (error) throw error;

        const next = new Set(assignedIds);
        next.add(activityTypeId);
        setAssigned(next);
      } else {
        const { error } = await supabase
          .from("contract_activity_types")
          .delete()
          .eq("contract_id", contract.id)
          .eq("activity_type_id", activityTypeId);

        if (error) throw error;

        const next = new Set(assignedIds);
        next.delete(activityTypeId);
        setAssigned(next);
      }
    } catch (e) {
      console.error("toggle contract activity", e);
      toast.error(e?.message || "Failed to update contract activities");
    } finally {
      setAssigning(false);
    }
  };

  const save = async () => {
    if (!isOwner) return;
    if (!form.name.trim()) return toast.error("Contract name is required");

    setSaving(true);
    try {
      await onSave?.(contract.id, {
        name: form.name.trim(),
        status: form.status || "active",
        contract_number: form.contract_number.trim() || null,
      });
      setMode("view");
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = assignedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-3xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold text-slate-100">Contract</div>
            <div className="text-xs text-slate-400">{contract?.id}</div>
          </div>
          <button className="btn" onClick={onClose} type="button" disabled={saving || assigning}>
            Close
          </button>
        </div>

        {/* Contract fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="text-sm">
            <div className="text-xs text-slate-400">Client (owner)</div>
            <div className="text-slate-100 font-medium">{contract?.client?.name || "—"}</div>
          </div>

          <div className="text-sm">
            <div className="text-xs text-slate-400">Vendor</div>
            <div className="text-slate-100 font-medium">{contract?.vendor?.name || "—"}</div>
          </div>

          <div className="md:col-span-2 border-t border-white/10 pt-3" />

          <label className="block text-sm md:col-span-2">
            Name
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            />
          </label>

          <label className="block text-sm">
            Status
            <select
              className="input w-full"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="closed">closed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>

          <label className="block text-sm">
            Contract #
            <input
              className="input w-full"
              value={form.contract_number}
              onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              disabled={mode !== "edit" || !isOwner}
            />
          </label>

          <div className="md:col-span-2 text-xs text-slate-400">
            Created: {contract?.created_at ? new Date(contract.created_at).toLocaleString() : "—"}
          </div>
        </div>

        {/* Activities section */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-medium text-slate-100">Activities (rates)</div>
              <div className="text-xs text-slate-400">
                Assigned: {activityLoading ? "…" : assignedCount}
                {isOwner ? " (owner can assign)" : " (read-only)"}
              </div>
            </div>
            <button type="button" className="btn" onClick={loadActivities} disabled={activityLoading || assigning}>
              {activityLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {activityLoading ? (
            <div className="mt-3 text-sm text-slate-300/70">Loading activities…</div>
          ) : isOwner ? (
            activityTypes.length === 0 ? (
              <div className="mt-3 text-sm text-slate-300/70">
                No activity types found for your organisation. Create some in Projects → Activities.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto -mx-2 md:mx-0">
                <table className="w-full text-xs md:text-sm min-w-[920px]">
                  <thead>
                    <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                      <th className="p-2 font-medium w-[1%]">Use</th>
                      <th className="p-2 font-medium">Activity</th>
                      <th className="p-2 font-medium">Billable</th>
                      <th className="p-2 font-medium">Rate</th>
                      <th className="p-2 font-medium">Period</th>
                      <th className="p-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityTypes.map((a) => {
                      const checked = assignedIds.has(a.id);
                      return (
                        <tr key={a.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={assigning}
                              onChange={(e) => toggleAssigned(a.id, e.target.checked)}
                              aria-label={`Assign ${a.activity_type}`}
                            />
                          </td>
                          <td className="p-2 font-medium">{a.activity_type}</td>
                          <td className="p-2">{a.billable ? "Yes" : "No"}</td>
                          <td className="p-2">{a.billable ? money(a.rate) : "—"}</td>
                          <td className="p-2">{a.billable ? a.rate_period || "—" : "—"}</td>
                          <td className="p-2">{a.description || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-2 text-xs text-slate-400">
                  Note: this uses the activity type’s default rate for now (no per-contract overrides in the UI yet).
                </div>
              </div>
            )
          ) : activityTypes.length === 0 ? (
            <div className="mt-3 text-sm text-slate-300/70">No activities assigned to this contract yet.</div>
          ) : (
            <div className="mt-3 overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                    <th className="p-2 font-medium">Activity</th>
                    <th className="p-2 font-medium">Billable</th>
                    <th className="p-2 font-medium">Rate</th>
                    <th className="p-2 font-medium">Period</th>
                    <th className="p-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {activityTypes.map((a) => {
                    const checked = assignedIds.has(a.id);
                    return (
                      <tr key={a.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                        <td className="p-2 font-medium">{a.activity_type}</td>
                        <td className="p-2">{a.billable ? "Yes" : "No"}</td>
                        <td className="p-2">{a.billable ? money(a.rate) : "—"}</td>
                        <td className="p-2">{a.billable ? a.rate_period || "—" : "—"}</td>
                        <td className="p-2">{a.description || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <div>
            {isOwner && mode === "edit" && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => onDelete?.(contract.id, contract.name)}
              >
                Delete contract…
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isOwner ? (
              mode === "view" ? (
                <button type="button" className="btn btn-primary" onClick={() => setMode("edit")}>
                  Edit
                </button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setMode("view")} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              )
            ) : (
              <div className="text-xs text-slate-400">Read-only (vendor)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}