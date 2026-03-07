"use client";

export default function AttributesTab({
  selectedHole,
  canEditHole,
  plannedDepthInput,
  savingPlannedDepth,
  onPlannedDepthChange,
  onSavePlannedDepth,

  waterLevelInput,
  savingWaterLevel,
  onWaterLevelChange,
  onSaveWaterLevel,

  azimuthInput,
  dipInput,
  collarLongitudeInput,
  collarLatitudeInput,
  collarElevationInput,
  collarSourceInput,
  startedAtInput,
  completedAtInput,
  completionStatusInput,
  completionNotesInput,
  onAttributesChange,
  onSaveAdditionalAttributes,
  savingAdditionalAttributes,
}) {
  const COLLAR_SOURCE_OPTIONS = ["", "gps", "survey", "estimated", "imported"];
  const COMPLETION_STATUS_OPTIONS = ["", "completed", "abandoned", "suspended"];

  return (
    <div className="space-y-3">
      {!selectedHole ? (
        <div className="text-sm text-slate-300">Select a hole.</div>
      ) : (
        <div className="card p-3 space-y-4">
          {/* Planned depth (existing) */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="text-xs text-slate-300 font-medium">Planned depth (m)</div>
            <div className="flex items-center gap-2">
              <input
                className="input input-xs w-full"
                type="number"
                step="0.1"
                placeholder="e.g. 120.0"
                value={plannedDepthInput ?? ""}
                disabled={!canEditHole}
                onChange={(e) => onPlannedDepthChange?.(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-xs btn-primary shrink-0"
                onClick={onSavePlannedDepth}
                disabled={!canEditHole || savingPlannedDepth}
              >
                {savingPlannedDepth ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="text-[11px] text-slate-500">Used for planned vs actual markers.</div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="text-xs text-slate-300 font-medium">Water level (m)</div>
            <div className="text-[11px] text-slate-500">
              Depth to water from ground level (0m). Leave blank if unknown.
            </div>

            <div className="flex items-center gap-2">
              <input
                className="input input-xs w-full"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 22.0"
                value={waterLevelInput ?? ""}
                disabled={!canEditHole}
                onChange={(e) => onWaterLevelChange?.(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-xs btn-primary shrink-0"
                onClick={onSaveWaterLevel}
                disabled={!canEditHole || savingWaterLevel}
              >
                {savingWaterLevel ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="text-xs text-slate-300 font-medium">Orientation</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Azimuth (deg)
                <input
                  className="input input-xs mt-1 w-full"
                  type="number"
                  step="0.1"
                  min="0"
                  max="359.9"
                  placeholder="0-359.9"
                  value={azimuthInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("azimuth", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Dip (deg)
                <input
                  className="input input-xs mt-1 w-full"
                  type="number"
                  step="0.1"
                  min="-90"
                  max="90"
                  placeholder="-90 to 90"
                  value={dipInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("dip", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="text-xs text-slate-300 font-medium">Collar (WGS84)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Longitude
                <input
                  className="input input-xs mt-1 w-full"
                  type="number"
                  step="0.000001"
                  placeholder="-180 to 180"
                  value={collarLongitudeInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("collar_longitude", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Latitude
                <input
                  className="input input-xs mt-1 w-full"
                  type="number"
                  step="0.000001"
                  placeholder="-90 to 90"
                  value={collarLatitudeInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("collar_latitude", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Elevation (m)
                <input
                  className="input input-xs mt-1 w-full"
                  type="number"
                  step="0.01"
                  value={collarElevationInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("collar_elevation_m", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Source
                <select
                  className="select-gradient-sm mt-1 w-full"
                  value={collarSourceInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("collar_source", e.target.value)}
                >
                  {COLLAR_SOURCE_OPTIONS.map((source) => (
                    <option key={source || "none"} value={source}>
                      {source || "Select..."}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="text-xs text-slate-300 font-medium">Completion</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Started at
                <input
                  className="input input-xs mt-1 w-full"
                  type="datetime-local"
                  value={startedAtInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("started_at", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300">
                Completed at
                <input
                  className="input input-xs mt-1 w-full"
                  type="datetime-local"
                  value={completedAtInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("completed_at", e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-300 md:col-span-2">
                Completion status
                <select
                  className="select-gradient-sm mt-1 w-full"
                  value={completionStatusInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("completion_status", e.target.value)}
                >
                  {COMPLETION_STATUS_OPTIONS.map((status) => (
                    <option key={status || "none"} value={status}>
                      {status || "Select..."}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300 md:col-span-2">
                Completion notes
                <textarea
                  className="textarea mt-1 w-full"
                  rows={3}
                  value={completionNotesInput ?? ""}
                  disabled={!canEditHole}
                  onChange={(e) => onAttributesChange?.("completion_notes", e.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={onSaveAdditionalAttributes}
                disabled={!canEditHole || savingAdditionalAttributes}
              >
                {savingAdditionalAttributes ? "Saving..." : "Save additional attributes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
