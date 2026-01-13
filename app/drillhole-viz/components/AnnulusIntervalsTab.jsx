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
  return (
    <div className="space-y-3">
      {!selectedHole ? (
        <div className="text-sm text-slate-300">Select a hole.</div>
      ) : (
        <div className="card p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Annulus intervals</div>
              <div className="text-[11px] text-slate-400 truncate">
                Hole: <span className="text-slate-200">{selectedHole.hole_id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn btn-xs" onClick={onAddRow} disabled={!canEdit}>
                + Row
              </button>
              <button type="button" className="btn btn-xs btn-primary" onClick={onSave} disabled={!canEdit || annulusSaving}>
                {annulusSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {annulusLoading ? (
            <div className="text-sm text-slate-300">Loading annulus…</div>
          ) : (annulusTypesActive || []).length === 0 ? (
            <div className="text-sm text-amber-300">
              No active annulus types found for this org. Add/enable them in <b>Annulus Types</b>.
            </div>
          ) : (
            <div className="space-y-2">
              {(annulusRows || []).length === 0 && <div className="text-xs text-slate-400 italic">No annulus intervals yet.</div>}

              {(annulusRows || []).map((r, idx) => {
                const t = r.annulus_type_id ? annulusById?.get?.(r.annulus_type_id) : null;
                const swatch = t?.color || "#64748b";

                return (
                  <div key={r.id || `new-ann-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
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
                          title={t?.name || "Annulus color"}
                        />
                        <select
                          className="select-gradient-sm w-full min-w-0"
                          value={r.annulus_type_id || ""}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { annulus_type_id: e.target.value })}
                        >
                          <option value="">Annulus…</option>
                          {(annulusTypesActive || []).map((at) => (
                            <option key={at.id} value={at.id}>
                              {at.name}
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
                Rules: From &lt; To, 0.1m precision, no overlaps (enforced by DB exclusion constraint).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}