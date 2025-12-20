"use client";

import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

function ActivityTypeModal({ form, setForm, saving, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">New Activity Type</h2>
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
            Group (optional)
            <input
              className="input w-full"
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
              placeholder="e.g. Production"
            />
          </label>

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
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminPanel({
  activityTypes = [],
  orgId,
  orgLoading,
  setActivityTypes,

  // legacy props (no longer used by this UI, but kept for compatibility)
  activityTypeForm = {},
  activityTypeLoading = false,
  handleActivityTypeChange,
  submitActivityType,
}) {
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState("activity-types");

  const emptyActivityType = {
    activity_type: "",
    description: "",
    group: "",
    label: "",
    plod_type_scope: ["all"],
  };

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newActivityType, setNewActivityType] = useState(emptyActivityType);

  const addActivityType = async () => {
    if (!orgId) return toast.error("Organisation not ready yet");
    if (!newActivityType.activity_type.trim()) return;

    setSaving(true);
    try {
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
      };

      const { data, error } = await supabase
        .from("plod_activity_types")
        .insert(payload)
        .select("id, activity_type, description, group, label, plod_type_scope")
        .single();

      if (error) throw error;

      setActivityTypes((arr) => [data, ...(arr || [])]);
      setShowModal(false);
      setNewActivityType(emptyActivityType);
      toast.success("Activity type added");
    } catch (e) {
      console.error("insert plod_activity_types error", e);
      toast.error(e?.message || "Could not add activity type");
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
              {activityTypes.length} item{activityTypes.length === 1 ? "" : "s"}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={orgLoading || !orgId}
              onClick={() => {
                setNewActivityType(emptyActivityType);
                setShowModal(true);
              }}
            >
              New Activity Type
            </button>
          </div>

          <div className="card p-4">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                    <th className="p-2 font-medium">Activity Type</th>
                    <th className="p-2 font-medium">Group</th>
                    <th className="p-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {activityTypes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-300/70">
                        No activity types found for this organisation.
                      </td>
                    </tr>
                  ) : (
                    activityTypes.map((t) => (
                      <tr
                        key={t.id || t.activity_type}
                        className="border-b border-white/10 last:border-b-0 hover:bg-white/5"
                      >
                        <td className="p-2 font-medium">{t.activity_type}</td>
                        <td className="p-2">{t.group || "—"}</td>
                        <td className="p-2">{t.description || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <ActivityTypeModal
              form={newActivityType}
              setForm={setNewActivityType}
              saving={saving}
              onClose={() => setShowModal(false)}
              onSave={addActivityType}
            />
          )}
        </div>
      )}
    </div>
  );
}