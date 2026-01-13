"use client";

export default function AttributesTab({
  selectedHole,
  canEditHole,
  plannedDepthInput,
  savingPlannedDepth,
  onPlannedDepthChange,
  onSavePlannedDepth,
}) {
  return (
    <div className="space-y-3">
      {!selectedHole ? (
        <div className="text-sm text-slate-300">Select a hole.</div>
      ) : (
        <>
          <div className="card p-3">
            <div className="text-sm font-medium text-slate-100">{selectedHole.hole_id}</div>
            <div className="text-[11px] text-slate-400">
              State: {selectedHole.state} · Planned: {selectedHole.planned_depth ?? "—"}m · Actual: {selectedHole.depth ?? "—"}m
            </div>
            {(selectedHole.planned_depth == null || selectedHole.planned_depth === "") && (
              <div className="mt-2 text-[11px] text-amber-300">PDF export requires Planned Depth to be set on the hole.</div>
            )}
          </div>

          <div className="card p-3 space-y-2">
            <div className="text-sm font-medium text-slate-100">Planned depth</div>

            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={plannedDepthInput}
                onChange={(e) => onPlannedDepthChange?.(e.target.value)}
                placeholder="e.g. 250.0"
                disabled={!canEditHole || savingPlannedDepth}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSavePlannedDepth}
                disabled={!canEditHole || savingPlannedDepth}
                title={!canEditHole ? "Insufficient role to edit" : "Save planned depth"}
              >
                {savingPlannedDepth ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="text-[11px] text-slate-400">Leave blank to unset. Used for PDF export + paging/clipping.</div>
          </div>

          <div className="card p-3">
            <div className="text-sm font-medium text-slate-100 mb-2">Data entry (V1)</div>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
              <li>Geology intervals (no overlap, 0.1m)</li>
              <li>Construction intervals (no overlap)</li>
              <li>Annulus intervals (no overlap)</li>
              <li>Sensors (depth points)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
