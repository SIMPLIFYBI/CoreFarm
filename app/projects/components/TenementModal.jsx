"use client";

export default function TenementModal({ editingId, form, setForm, saving, onClose, onSave, onNew }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit Tenement" : "New Tenement"}</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <label className="block text-sm">
            Tenement Number *
            <input
              type="text"
              value={form.tenement_number}
              onChange={(e) => setForm((f) => ({ ...f, tenement_number: e.target.value }))}
              className="input"
              placeholder="Tenement number"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              Type
              <input
                type="text"
                value={form.tenement_type}
                onChange={(e) => setForm((f) => ({ ...f, tenement_type: e.target.value }))}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Application #
              <input
                type="text"
                value={form.application_number}
                onChange={(e) => setForm((f) => ({ ...f, application_number: e.target.value }))}
                className="input"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              Status
              <input
                type="text"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Expenditure
              <input
                type="number"
                step="0.01"
                value={form.expenditure_commitment}
                onChange={(e) => setForm((f) => ({ ...f, expenditure_commitment: e.target.value }))}
                className="input"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              Date Applied
              <input
                type="date"
                value={form.date_applied}
                onChange={(e) => setForm((f) => ({ ...f, date_applied: e.target.value }))}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Date Granted
              <input
                type="date"
                value={form.date_granted}
                onChange={(e) => setForm((f) => ({ ...f, date_granted: e.target.value }))}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Renewal Date
              <input
                type="date"
                value={form.renewal_date}
                onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
                className="input"
              />
            </label>
          </div>

          <label className="block text-sm">
            Heritage Agreements
            <textarea
              value={form.heritage_agreements}
              onChange={(e) => setForm((f) => ({ ...f, heritage_agreements: e.target.value }))}
              className="input"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.tenement_number.trim()}
            className="btn btn-primary flex-1"
          >
            {saving ? "Saving…" : editingId ? "Save Changes" : "Create Tenement"}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={onNew}>
              New
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-300/70">Only members of this organization can manage tenements.</div>
      </div>
    </div>
  );
}