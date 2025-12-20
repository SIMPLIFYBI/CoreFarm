"use client";

export default function VendorModal({ editingId, form, setForm, saving, onClose, onSave, onNew }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit Vendor" : "New Vendor"}</h2>
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
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Vendor name"
              required
            />
          </label>

          <label className="block text-sm">
            Contact (optional)
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              className="input"
              placeholder="Phone / email / contact person"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="btn btn-primary flex-1"
          >
            {saving ? "Saving…" : editingId ? "Save Changes" : "Create Vendor"}
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