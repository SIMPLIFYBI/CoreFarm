"use client";

export default function AnnulusIntervalsTab({
  selectedHole,
  canEdit,
  annulusLoading,
  annulusSaving,
  annulusRows,
  annulusTypesActive,
  annulusById,
  onAddRow,
  onSave,
  onUpdateRow,
  onRemoveRow,
}) {
  const rowCount = (annulusRows || []).length;

  return (
    <div className="space-y-4">
      {!selectedHole ? (
        <div className="glass rounded-2xl border border-white/10 p-4 text-sm text-slate-300">Select a hole.</div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold text-slate-100">Annulus intervals</div>
              <div className="text-xs text-slate-400 truncate">
                Hole: <span className="text-slate-200">{selectedHole.hole_id}</span> · {rowCount} rows
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn h-10 min-h-0 px-4 text-xs" onClick={onAddRow} disabled={!canEdit}>
                Add interval
              </button>
              <button
                type="button"
                className="btn btn-primary h-10 min-h-0 px-4 text-xs"
                onClick={onSave}
                disabled={!canEdit || annulusSaving}
              >
                {annulusSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          {annulusLoading ? (
            <div className="glass rounded-xl border border-white/10 p-3 text-sm text-slate-300">Loading annulus...</div>
          ) : (annulusTypesActive || []).length === 0 ? (
            <div className="glass rounded-xl border border-amber-300/30 p-3 text-sm text-amber-300">
              No active annulus types found for this org. Add/enable them in <b>Annulus Types</b>.
            </div>
          ) : (
            <div className="space-y-3">
              {rowCount === 0 && (
                <div className="glass rounded-xl border border-white/10 p-3 text-xs italic text-slate-400">
                  No annulus intervals yet.
                </div>
              )}

              {(annulusRows || []).map((r, idx) => {
                const t = r.annulus_type_id ? annulusById?.get?.(r.annulus_type_id) : null;
                const swatch = t?.color || "#64748b";

                return (
                  <div key={r.id || `new-ann-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(92px,1fr)_minmax(92px,1fr)_minmax(0,2.6fr)_48px] gap-3 items-end">
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">From (m)</label>
                        <input
                          className="input h-10 min-h-0 w-full"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={r.from_m}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { from_m: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">To (m)</label>
                        <input
                          className="input h-10 min-h-0 w-full"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={r.to_m}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { to_m: e.target.value })}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Annulus Type</label>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-3 w-3 rounded-sm border border-white/20 shrink-0"
                            style={{ backgroundColor: swatch }}
                            title={t?.name || "Annulus color"}
                          />
                          <select
                            className="select h-10 min-h-0 w-full"
                            value={r.annulus_type_id || ""}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateRow(idx, { annulus_type_id: e.target.value })}
                          >
                            <option value="">Choose annulus type</option>
                            {(annulusTypesActive || []).map((at) => (
                              <option key={at.id} value={at.id}>
                                {at.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="h-10 min-h-0 w-full rounded-xl border border-rose-300/35 bg-rose-500/10 text-rose-200 transition-base hover:bg-rose-500/20 disabled:opacity-50 flex items-center justify-center"
                          onClick={() => onRemoveRow(idx)}
                          disabled={!canEdit}
                          title="Remove interval"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="text-xs text-slate-400">
                Rules: From &lt; To, 0.1m precision, no overlaps (enforced by DB exclusion constraint).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}