"use client";

import { AUSTRALIAN_PROJECT_CRS, getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";

export default function ProjectModal({ editingId, form, setForm, saving, onClose, onSave, onNew }) {
  const selectedCrs = getAustralianProjectCrsByCode(form.coordinate_crs_code);

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

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-sm font-medium text-slate-100">Coordinate system</div>
            <div className="mt-1 text-xs text-slate-300/70">
              Set the working project CRS used for projected coordinates such as easting and northing.
            </div>

            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                Australian CRS
                <select
                  value={form.coordinate_crs_code || ""}
                  onChange={(e) => {
                    const crs = getAustralianProjectCrsByCode(e.target.value);
                    setForm((f) => ({
                      ...f,
                      coordinate_crs_code: crs?.code || "",
                      coordinate_crs_name: crs?.name || "",
                    }));
                  }}
                  className="input"
                >
                  <option value="">Select coordinate system</option>
                  {AUSTRALIAN_PROJECT_CRS.map((crs) => (
                    <option key={crs.code} value={crs.code}>
                      {crs.name} ({crs.code})
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                {selectedCrs
                  ? `Selected: ${selectedCrs.name} (${selectedCrs.code})`
                  : "Projected coordinates will stay unconfigured until you choose a project CRS."}
              </div>
            </div>
          </div>
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