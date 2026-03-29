"use client";

import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";

const HOLE_STATE_OPTIONS = [
  { value: "proposed", label: "Proposed" },
  { value: "in_progress", label: "In Progress" },
  { value: "drilled", label: "Drilled" },
];

const ASSET_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

function formatCoordinate(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return numericValue.toFixed(6);
}

function resolveProjectCrs(project) {
  const known = getAustralianProjectCrsByCode(project?.coordinate_crs_code || "");
  if (known) return `${known.name} (${known.code})`;
  if (project?.coordinate_crs_name || project?.coordinate_crs_code) {
    return project.coordinate_crs_name || project.coordinate_crs_code;
  }
  return "Not set on project yet";
}

export default function MapCreateEntityPanel({
  entityType,
  onEntityTypeChange,
  holeDraft,
  assetDraft,
  onHoleDraftChange,
  onAssetDraftChange,
  projects,
  assetTypes,
  assetLocations,
  saving,
  onClose,
  onSave,
}) {
  const draft = entityType === "hole" ? holeDraft : assetDraft;
  const setDraft = entityType === "hole" ? onHoleDraftChange : onAssetDraftChange;
  const selectedProject = projects.find((project) => project.id === draft.project_id) || null;
  const selectedPointReady = draft.longitude !== "" && draft.latitude !== "";

  return (
    <div className="pointer-events-none absolute inset-x-3 inset-y-3 z-20 flex items-start justify-end md:inset-x-4 md:inset-y-4">
      <div className="pointer-events-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] shadow-[0_30px_90px_rgba(2,6,23,0.48)] backdrop-blur-xl">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.52),rgba(15,23,42,0.94)_55%,rgba(249,115,22,0.18))] px-4 py-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Create On Map</div>
              <div className="mt-1 text-lg font-semibold text-white">Add {entityType === "hole" ? "hole" : "asset"}</div>
              <div className="mt-1 text-sm text-slate-300">Point selected. Choose hole or asset, set the quick details, then save.</div>
            </div>
            <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-1.5">
            <button
              type="button"
              className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${entityType === "hole" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
              onClick={() => onEntityTypeChange("hole")}
            >
              Hole
            </button>
            <button
              type="button"
              className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${entityType === "asset" ? "bg-rose-300 text-slate-950 shadow-[0_12px_28px_rgba(244,114,182,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
              onClick={() => onEntityTypeChange("asset")}
            >
              Asset
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5 md:py-5">
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Project
              <select
                value={draft.project_id}
                onChange={(event) => setDraft((current) => ({ ...current, project_id: event.target.value }))}
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
              >
                <option value="">Select project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedProject ? (
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-3 text-xs text-slate-300">
                Working CRS: {resolveProjectCrs(selectedProject)}
              </div>
            ) : null}

            <div className="rounded-[24px] border border-orange-300/15 bg-orange-400/8 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-orange-100/75">Picked point</div>
              {selectedPointReady ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-100">
                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Longitude</div>
                    <div className="mt-1 font-semibold text-white">{formatCoordinate(draft.longitude)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Latitude</div>
                    <div className="mt-1 font-semibold text-white">{formatCoordinate(draft.latitude)}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-200">Click a free point on the map canvas to capture coordinates.</div>
              )}
              {selectedPointReady ? <div className="mt-3 text-xs text-slate-300">Click another free point on the map if you want to move it before saving.</div> : null}
            </div>

            {entityType === "hole" ? (
              <>
                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Hole ID
                  <input
                    value={holeDraft.hole_id}
                    onChange={(event) => onHoleDraftChange((current) => ({ ...current, hole_id: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                    placeholder="DDH-001"
                  />
                </label>

                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  State
                  <select
                    value={holeDraft.state}
                    onChange={(event) => onHoleDraftChange((current) => ({ ...current, state: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  >
                    {HOLE_STATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-6 text-slate-300">
                  This quick add creates the hole with map-picked WGS84 collar coordinates. You can enrich the rest of the drilling details later in Core Workbench.
                </div>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Asset Name
                  <input
                    value={assetDraft.name}
                    onChange={(event) => onAssetDraftChange((current) => ({ ...current, name: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                    placeholder="Pump 01"
                  />
                </label>

                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Asset Type
                  <select
                    value={assetDraft.asset_type_id}
                    onChange={(event) => onAssetDraftChange((current) => ({ ...current, asset_type_id: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  >
                    <option value="">Select type...</option>
                    {assetTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Location
                  <select
                    value={assetDraft.location_id}
                    onChange={(event) => onAssetDraftChange((current) => ({ ...current, location_id: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  >
                    <option value="">Select location...</option>
                    {assetLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Status
                  <select
                    value={assetDraft.status}
                    onChange={(event) => onAssetDraftChange((current) => ({ ...current, status: event.target.value }))}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
                  >
                    {ASSET_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-4 md:px-5">
          <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0ea5e9)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving..." : `Create ${entityType === "hole" ? "Hole" : "Asset"}`}
          </button>
        </div>
      </div>
    </div>
  );
}