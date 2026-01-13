"use client";

export default function ConstructionIntervalsTab({
  selectedHole,
  canEdit,
  constructionLoading,
  constructionSaving,
  constructionRows,
  constructionTypesActive,
  constructionById,
  onAddRow,
  onSave,
  onUpdateRow,
  onRemoveRow,
}) {
  return (
    <div className="space-y-3">
      {!selectedHole ? (
        <div className="text-sm text-slate-300">Select a hole.</div>
      ) : (
        <div className="card p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Construction intervals</div>
              <div className="text-[11px] text-slate-400 truncate">
                Hole: <span className="text-slate-200">{selectedHole.hole_id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn btn-xs" onClick={onAddRow} disabled={!canEdit}>
                + Row
              </button>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={onSave}
                disabled={!canEdit || constructionSaving}
              >
                {constructionSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {constructionLoading ? (
            <div className="text-sm text-slate-300">Loading construction…</div>
          ) : (constructionTypesActive || []).length === 0 ? (
            <div className="text-sm text-amber-300">
              No active construction types found for this org. Add/enable them in <b>Construction Types</b>.
            </div>
          ) : (
            <div className="space-y-2">
              {(constructionRows || []).length === 0 && (
                <div className="text-xs text-slate-400 italic">No construction intervals yet.</div>
              )}

              {(constructionRows || []).map((r, idx) => {
                const t = r.construction_type_id ? constructionById?.get?.(r.construction_type_id) : null;
                const swatch = t?.color || "#64748b";

                return (
                  <div key={r.id || `new-con-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                    <div
                      className={[
                        "grid gap-2 items-center",
                        "grid-cols-1",
                        "md:grid-cols-[minmax(96px,1fr)_minmax(96px,1fr)_minmax(220px,2.2fr)_minmax(160px,2fr)_auto]",
                      ].join(" ")}
                    >
                      <input
                        className="input input-xs w-full"
                        type="number"
                        step="0.1"
                        placeholder="From (m)"
                        value={r.from_m}
                        disabled={!canEdit}
                        onChange={(e) => onUpdateRow(idx, { from_m: e.target.value })}
                      />
                      <input
                        className="input input-xs w-full"
                        type="number"
                        step="0.1"
                        placeholder="To (m)"
                        value={r.to_m}
                        disabled={!canEdit}
                        onChange={(e) => onUpdateRow(idx, { to_m: e.target.value })}
                      />

                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-3 w-3 rounded-sm border border-white/20 shrink-0"
                          style={{ backgroundColor: swatch }}
                          title={t?.name || "Construction color"}
                        />
                        <select
                          className="select-gradient-sm w-full min-w-0"
                          value={r.construction_type_id || ""}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { construction_type_id: e.target.value })}
                        >
                          <option value="">Construction…</option>
                          {(constructionTypesActive || []).map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        className="input input-xs w-full"
                        type="text"
                        placeholder="Notes"
                        value={r.notes || ""}
                        disabled={!canEdit}
                        onChange={(e) => onUpdateRow(idx, { notes: e.target.value })}
                      />

                      <button
                        type="button"
                        className="btn btn-xs w-full md:w-auto"
                        onClick={() => onRemoveRow(idx)}
                        disabled={!canEdit}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="text-[11px] text-slate-400">
                Rules: From &lt; To, 0.1m precision, no overlaps (also enforced by DB exclusion constraint).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}