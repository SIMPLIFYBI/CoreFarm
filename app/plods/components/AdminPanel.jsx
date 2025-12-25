"use client";

import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(n);
}

function formatRatePeriod(p) {
  if (!p) return "—";
  const map = { hourly: "Hourly", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  return map[p] || p;
}

function ActivityTypeModal({ form, setForm, saving, onClose, onSave, isEditing }) {
  const billable = !!form.billable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? "Edit Activity Type" : "New Activity Type"}
          </h2>
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label className="block text-sm">
            Activity Type
            <input
              className="input w-full"
              value={form.activity_type}
              onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              placeholder="e.g. Drill & Blast"
              required
            />
          </label>

          <label className="block text-sm">
            Plod Category
            <select
              className="input w-full"
              value={(form.plod_type_scope && form.plod_type_scope[0]) || "all"}
              onChange={(e) => setForm((f) => ({ ...f, plod_type_scope: [e.target.value] }))}
            >
              <option value="all">All</option>
              <option value="drill_blast">Drill &amp; Blast</option>
              <option value="drilling_geology">Drilling &amp; Geology</option>
              <option value="load_haul">Load &amp; Haul</option>
              <option value="general_works">General Works</option>
            </select>
          </label>

          {/* NEW: Billable */}
          <label className="block text-sm">
            Billable
            <select
              className="input w-full"
              value={billable ? "yes" : "no"}
              onChange={(e) => {
                const nextBillable = e.target.value === "yes";
                setForm((f) => ({
                  ...f,
                  billable: nextBillable,
                  rate: nextBillable ? f.rate : "",
                  rate_period: nextBillable ? f.rate_period || "hourly" : "",
                }));
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>

          {/* NEW: Rate + Rate Period */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Rate
              <input
                className="input w-full"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                disabled={!billable}
                value={form.rate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder="0.00"
              />
            </label>

            <label className="block text-sm">
              Rate Period
              <select
                className="input w-full"
                disabled={!billable}
                value={form.rate_period || "hourly"}
                onChange={(e) => setForm((f) => ({ ...f, rate_period: e.target.value }))}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Description (optional)
            <textarea
              className="input w-full"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…"
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.activity_type.trim()}>
              {saving ? "Saving…" : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PLOD_SCOPE_LABELS = {
  all: "All",
  drill_blast: "Drill & Blast",
  drilling_geology: "Drilling & Geology",
  load_haul: "Load & Haul",
  general_works: "General Works",
};

function formatPlodScope(scope) {
  if (!scope) return "—";
  const arr = Array.isArray(scope) ? scope : [scope];
  if (arr.length === 0) return "—";
  if (arr.includes("all")) return "All";
  return arr.map((x) => PLOD_SCOPE_LABELS[x] || x).join(", ");
}

export function AdminPanel({ activityTypes, setActivityTypes, orgLoading, orgId }) {
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState("activity-types");

  const emptyActivityType = {
    activity_type: "",
    description: "",
    group: "",
    label: "",
    plod_type_scope: ["all"],
    billable: false,     // NEW
    rate: "",            // NEW (string while editing)
    rate_period: "",     // NEW
  };

  const [editingActivityTypeId, setEditingActivityTypeId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newActivityType, setNewActivityType] = useState(emptyActivityType);

  const openCreateActivityType = () => {
    setEditingActivityTypeId(null);
    setNewActivityType(emptyActivityType);
    setShowModal(true);
  };

  const handleEditClick = (row) => {
    setEditingActivityTypeId(row.id);

    const scopeArr = Array.isArray(row.plod_type_scope) ? row.plod_type_scope : [];
    const scopeValue = scopeArr[0] || "all";

    setNewActivityType({
      ...emptyActivityType,
      activity_type: row.activity_type ?? "",
      description: row.description ?? "",
      group: row.group ?? "",
      label: row.label ?? "",
      plod_type_scope: [scopeValue],
      billable: !!row.billable,                         // NEW
      rate: row.rate ?? "",                             // NEW
      rate_period: row.rate_period ?? (row.billable ? "hourly" : ""), // NEW
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivityTypeId(null);
    setNewActivityType(emptyActivityType);
  };

  const saveActivityType = async () => {
    if (!orgId) return toast.error("Organisation not ready yet");
    if (!newActivityType.activity_type.trim()) return;

    setSaving(true);
    try {
      const billable = !!newActivityType.billable;

      const rateNum =
        newActivityType.rate === "" || newActivityType.rate === null || newActivityType.rate === undefined
          ? null
          : Number(newActivityType.rate);

      const payload = {
        organization_id: orgId,
        activity_type: newActivityType.activity_type.trim(),
        description: newActivityType.description?.trim() || null,
        group: newActivityType.group?.trim() || null,
        label: newActivityType.label?.trim() || null,
        plod_type_scope:
          Array.isArray(newActivityType.plod_type_scope) && newActivityType.plod_type_scope.length
            ? newActivityType.plod_type_scope
            : ["all"],

        // NEW
        billable,
        rate: billable && Number.isFinite(rateNum) ? rateNum : null,
        rate_period: billable ? (newActivityType.rate_period || "hourly") : null,
      };

      let data;

      const returning =
        "id, organization_id, activity_type, description, group, label, plod_type_scope, billable, rate, rate_period";

      if (editingActivityTypeId) {
        const res = await supabase
          .from("plod_activity_types")
          .update(payload)
          .eq("id", editingActivityTypeId)
          .eq("organization_id", orgId)
          .select(returning)
          .single();

        if (res.error) throw res.error;
        data = res.data;

        if (typeof setActivityTypes === "function") {
          setActivityTypes((arr) => (arr || []).map((x) => (x.id === data.id ? data : x)));
        }

        toast.success("Activity type updated");
      } else {
        const res = await supabase
          .from("plod_activity_types")
          .insert(payload)
          .select(returning)
          .single();

        if (res.error) throw res.error;
        data = res.data;

        if (typeof setActivityTypes === "function") {
          setActivityTypes((arr) => [data, ...(arr || [])]);
        }

        toast.success("Activity type added");
      }

      closeModal();
    } catch (e) {
      console.error("save plod_activity_types error", e);
      toast.error(e?.message || "Could not save activity type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("activity-types")}
          className={`btn ${tab === "activity-types" ? "btn-primary" : ""}`}
        >
          Activity Types
        </button>
      </div>

      {tab === "activity-types" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-300/70">
              {(activityTypes?.length || 0)} item{(activityTypes?.length || 0) === 1 ? "" : "s"}
            </div>

            <button type="button" className="btn btn-primary" disabled={orgLoading || !orgId} onClick={openCreateActivityType}>
              Add Activity Type
            </button>
          </div>

          <div className="card p-4">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[920px]">
                <thead>
                  <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                    <th className="p-2 font-medium">Activity Type</th>
                    <th className="p-2 font-medium">Plod Category</th>
                    <th className="p-2 font-medium">Billable</th>
                    <th className="p-2 font-medium">Rate</th>
                    <th className="p-2 font-medium">Rate Period</th>
                    <th className="p-2 font-medium">Description</th>
                    <th className="p-2 font-medium w-[1%]"></th>
                  </tr>
                </thead>

                <tbody>
                  {(activityTypes || []).map((t) => (
                    <tr key={t.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                      <td className="p-2 font-medium">{t.activity_type}</td>
                      <td className="p-2">{formatPlodScope(t.plod_type_scope)}</td>
                      <td className="p-2">{t.billable ? "Yes" : "No"}</td>
                      <td className="p-2">{t.billable ? formatMoney(t.rate) : "—"}</td>
                      <td className="p-2">{t.billable ? formatRatePeriod(t.rate_period) : "—"}</td>
                      <td className="p-2">{t.description || "—"}</td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                          onClick={() => handleEditClick(t)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <ActivityTypeModal
              form={newActivityType}
              setForm={setNewActivityType}
              saving={saving}
              onClose={closeModal}
              onSave={saveActivityType}
              isEditing={!!editingActivityTypeId}
            />
          )}
        </div>
      )}
    </div>
  );
}