"use client";

export default function AttributesTab({
  selectedHole,
  canEditHole,
  plannedDepthInput,
  savingPlannedDepth,
  onPlannedDepthChange,
  onSavePlannedDepth,

  // NEW
  waterLevelInput,
  savingWaterLevel,
  onWaterLevelChange,
  onSaveWaterLevel,
}) {
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
                {savingPlannedDepth ? "Saving…" : "Save"}
              </button>
            </div>
            <div className="text-[11px] text-slate-500">Used for planned vs actual markers.</div>
          </div>

          {/* NEW: Water level */}
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
                {savingWaterLevel ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
