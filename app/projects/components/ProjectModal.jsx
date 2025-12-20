"use client";

export default function ProjectModal({ editingId, form, setForm, saving, onClose, onSave, onNew }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit Project" : "New Project"}</h2>
          <button className="btn" onClick={onClose}>
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
              placeholder="Project Name"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              Start
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="input"
              />
            </label>
            <label className="block text-sm">
              Finish
              <input
                type="date"
                value={form.finish_date}
                onChange={(e) => setForm((f) => ({ ...f, finish_date: e.target.value }))}
                className="input"
              />
            </label>
          </div>

          <label className="block text-sm">
            Cost Code
            <input
              type="text"
              value={form.cost_code}
              onChange={(e) => setForm((f) => ({ ...f, cost_code: e.target.value }))}
              className="input"
            />
          </label>

          <label className="block text-sm">
            WBS Code
            <input
              type="text"
              value={form.wbs_code}
              onChange={(e) => setForm((f) => ({ ...f, wbs_code: e.target.value }))}
              className="input"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="btn btn-primary flex-1">
            {saving ? "Saving…" : editingId ? "Save Changes" : "Create Project"}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={onNew}>
              New
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-300/70">Only members of this organization can see these projects.</div>
      </div>
    </div>
  );
}