"use client";

const RESOURCE_TYPES = [
  "Drill Rig",
  "Dump Truck",
  "General Earthworks",
  "Ancillary",
  "Water Cart",
  "Other",
];

export default function ResourceModal({
  editingId,
  form,
  setForm,
  saving,
  vendors = [],
  onClose,
  onSave,
  onNew,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit Resource" : "New Resource"}
          </h2>
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <label className="block text-sm">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="input"
              placeholder="Resource name"
            />
          </label>

          <label className="block text-sm">
            Resource Type
            <select
              value={form.resource_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, resource_type: e.target.value }))
              }
              className="input"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="input"
              placeholder="Optional notes..."
              rows={4}
            />
          </label>

          <label className="block text-sm">
            Vendor (optional)
            <select
              value={form.vendor_id || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, vendor_id: e.target.value }))
              }
              className="input"
            >
              <option value="">— None —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="btn btn-primary flex-1"
          >
            {saving
              ? "Saving…"
              : editingId
              ? "Save Changes"
              : "Create Resource"}
          </button>

          {editingId && (
            <button type="button" className="btn" onClick={onNew}>
              New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}