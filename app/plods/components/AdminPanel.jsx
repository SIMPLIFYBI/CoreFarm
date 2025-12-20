"use client";

import React, { useState } from "react";
import { Spinner } from "./Spinner";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

export function AdminPanel({
  vendors = [],
  vendorForm = {},
  activityTypeForm = {},
  vendorLoading = false,
  handleVendorChange,
  submitVendor,
  toggleVendorExpand,
  expandedVendor,
  vendorResources = {},
  openAddResourceModal,
  openEditResourceModal,
  deleteResource,
  activityTypes = [],
  activityTypeLoading = false,
  handleActivityTypeChange,
  submitActivityType,
  orgId,
  orgLoading,
  setActivityTypes,
}) {
  const supabase = supabaseBrowser();

  const vendorFormSafe = {
    name: "",
    contact: "",
    organization_id: "",
    ...vendorForm,
  };
  const activityTypeFormSafe = {
    activityType: "",
    group: "",
    description: "",
    organization_id: "",
    ...activityTypeForm,
  };

  const [tab, setTab] = useState("vendors");
  const [newActivityType, setNewActivityType] = useState({
    activity_type: "",
    description: "",
    group: "",
    label: "",
    plod_type_scope: ["all"],
  });

  const addActivityType = async () => {
    if (!orgId) return toast.error("Organisation not ready yet");

    const payload = {
      organization_id: orgId,
      activity_type: (newActivityType.activity_type || "").trim(),
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

    if (error) {
      console.error("insert plod_activity_types error", error);
      return toast.error(error.message || "Could not add activity type");
    }

    setActivityTypes((arr) => [data, ...(arr || [])]);
    toast.success("Activity type added");
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("vendors")}
          className={`btn ${tab === "vendors" ? "btn-primary" : ""}`}
        >
          Vendors
        </button>
        <button
          type="button"
          onClick={() => setTab("activity-types")}
          className={`btn ${tab === "activity-types" ? "btn-primary" : ""}`}
        >
          Activity Types
        </button>
      </div>

      {tab === "vendors" && (
        <div className="space-y-4">
          <form onSubmit={submitVendor} className="card p-4 space-y-3">
            <div className="font-semibold text-slate-100">Add Vendor</div>
            <input
              className="input"
              placeholder="Name"
              value={vendorFormSafe.name}
              onChange={handleVendorChange("name")}
              required
            />
            <input
              className="input"
              placeholder="Contact"
              value={vendorFormSafe.contact}
              onChange={handleVendorChange("contact")}
            />
            <input
              className="input"
              placeholder="Organization ID"
              value={vendorFormSafe.organization_id}
              onChange={handleVendorChange("organization_id")}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={vendorLoading}
            >
              {vendorLoading && <Spinner size={14} />} Save Vendor
            </button>
          </form>

          <div>
            <div className="px-1 py-1 font-semibold text-slate-100">Vendors in this org</div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="py-2 px-3 text-left">Name</th>
                    <th className="py-2 px-3 text-left">Contact</th>
                    <th className="py-2 px-3 text-left">Org ID</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.length === 0 ? (
                    <tr>
                      <td className="py-2 px-3 text-slate-400" colSpan={3}>
                        No vendors found.
                      </td>
                    </tr>
                  ) : (
                    vendors.map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{v.contact}</td>
                        <td>{v.organization_id}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "activity-types" && (
        <div className="space-y-4">
          <form onSubmit={submitActivityType} className="card p-4 space-y-3">
            <div className="font-semibold text-slate-100">Add Activity Type</div>
            <input
              className="input"
              placeholder="Activity Type"
              value={activityTypeFormSafe.activityType}
              onChange={handleActivityTypeChange("activityType")}
              required
            />
            <input
              className="input"
              placeholder="Group"
              value={activityTypeFormSafe.group}
              onChange={handleActivityTypeChange("group")}
            />
            <input
              className="input"
              placeholder="Description"
              value={activityTypeFormSafe.description}
              onChange={handleActivityTypeChange("description")}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={activityTypeLoading}
            >
              {activityTypeLoading && <Spinner size={14} />} Save Activity Type
            </button>
          </form>

          <div className="space-y-2">
            {activityTypes.map((t) => (
              <div key={t.id || t.activityType} className="card p-3">
                <div className="font-semibold text-slate-100">{t.activityType || t.name}</div>
                {t.group && <div className="text-sm text-slate-300">{t.group}</div>}
                {t.description && <div className="text-sm text-slate-300">{t.description}</div>}
              </div>
            ))}
          </div>

          {/* Activity Types form */}
          <div className="space-y-2">
            {/* TEMP DEBUG: show org id being used for inserts */}
            <label className="block text-xs text-slate-300">Organisation ID (auto)</label>
            <input
              className="input w-full"
              value={orgId ?? ""}
              readOnly
              disabled
            />
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={orgLoading || !orgId}
        onClick={addActivityType}
      >
        Add activity type
      </button>
    </div>
  );
}