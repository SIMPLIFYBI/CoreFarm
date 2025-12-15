import React, { useState } from "react";
import { Spinner } from "./Spinner";

export function AdminPanel({
  vendors = [],
  vendorForm,
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
  activityTypeForm,
  activityTypeLoading = false,
  handleActivityTypeChange,
  submitActivityType,
}) {
  const [tab, setTab] = useState("vendors");

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("vendors")}
          className={`px-3 py-2 rounded border ${tab === "vendors" ? "bg-indigo-600 text-white" : "bg-white"}`}
        >
          Vendors
        </button>
        <button
          type="button"
          onClick={() => setTab("activity-types")}
          className={`px-3 py-2 rounded border ${tab === "activity-types" ? "bg-indigo-600 text-white" : "bg-white"}`}
        >
          Activity Types
        </button>
      </div>

      {tab === "vendors" && (
        <div className="space-y-4">
          <form onSubmit={submitVendor} className="space-y-3 rounded border p-4 bg-white">
            <div className="font-semibold">Add Vendor</div>
            <input
              className="w-full rounded border p-2"
              placeholder="Name"
              value={vendorForm.name}
              onChange={handleVendorChange("name")}
              required
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Contact"
              value={vendorForm.contact}
              onChange={handleVendorChange("contact")}
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Organization ID"
              value={vendorForm.organization_id}
              onChange={handleVendorChange("organization_id")}
              required
            />
            <button
              type="submit"
              className="px-3 py-2 rounded bg-indigo-600 text-white flex items-center gap-2"
              disabled={vendorLoading}
            >
              {vendorLoading && <Spinner size={14} />} Save Vendor
            </button>
          </form>

          <div className="space-y-2">
            {vendors.map((v) => {
              const resources = vendorResources?.[v.id] || [];
              const isOpen = expandedVendor === v.id;
              return (
                <div key={v.id} className="rounded border p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-sm text-gray-500">{v.contact}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-sm"
                        onClick={() => toggleVendorExpand(v.id)}
                      >
                        {isOpen ? "Hide Resources" : "Show Resources"}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-sm"
                        onClick={() => openAddResourceModal(v.id)}
                      >
                        Add Resource
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-2">
                      {resources.length === 0 ? (
                        <div className="text-sm text-gray-500">No resources</div>
                      ) : (
                        resources.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded border px-2 py-1 text-sm"
                          >
                            <div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-gray-500">{r.resource_type}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border"
                                onClick={() => openEditResourceModal(r)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded border text-red-600"
                                onClick={() => deleteResource(r.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "activity-types" && (
        <div className="space-y-4">
          <form onSubmit={submitActivityType} className="space-y-3 rounded border p-4 bg-white">
            <div className="font-semibold">Add Activity Type</div>
            <input
              className="w-full rounded border p-2"
              placeholder="Activity Type"
              value={activityTypeForm.activityType}
              onChange={handleActivityTypeChange("activityType")}
              required
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Group"
              value={activityTypeForm.group}
              onChange={handleActivityTypeChange("group")}
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Description"
              value={activityTypeForm.description}
              onChange={handleActivityTypeChange("description")}
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Organization ID"
              value={activityTypeForm.organization_id}
              onChange={handleActivityTypeChange("organization_id")}
              required
            />
            <button
              type="submit"
              className="px-3 py-2 rounded bg-indigo-600 text-white flex items-center gap-2"
              disabled={activityTypeLoading}
            >
              {activityTypeLoading && <Spinner size={14} />} Save Activity Type
            </button>
          </form>

          <div className="space-y-2">
            {activityTypes.map((t) => (
              <div key={t.id || t.activityType} className="rounded border p-3 bg-white">
                <div className="font-semibold">{t.activityType || t.name}</div>
                <div className="text-sm text-gray-500">{t.group}</div>
                <div className="text-sm text-gray-500">{t.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}