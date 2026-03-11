"use client";

const STATUS_OPTIONS = ["planned", "installed", "inactive", "removed"];

function renderFieldInput(field, value, onChange, disabled) {
  const type = String(field?.type || "text").toLowerCase();

  if (type === "textarea") {
    return (
      <textarea
        className="textarea w-full min-h-[88px]"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (type === "boolean") {
    return (
      <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 text-sm text-slate-200">
        <input type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{field?.label || field?.key}</span>
      </label>
    );
  }

  if (type === "select") {
    return (
      <select className="select h-10 min-h-0 w-full" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {(field?.options || []).map((option) => {
          const optionValue = typeof option === "string" ? option : option?.value;
          const optionLabel = typeof option === "string" ? option : option?.label || option?.value;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <input
      className="input h-10 min-h-0 w-full"
      type={type === "number" ? "number" : "text"}
      step={type === "number" ? "0.1" : undefined}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
    />
  );
}

export default function ComponentsTab({
  selectedHole,
  canEdit,
  componentLoading,
  componentSaving,
  componentRows,
  componentTypesActive,
  componentById,
  onAddRow,
  onSave,
  onUpdateRow,
  onRemoveRow,
}) {
  const rowCount = (componentRows || []).length;
  const confirmRemoveRow = (index, row, type) => {
    const label = row?.label || type?.name || "this component";
    const ok = window.confirm(`This will permanently delete ${label}. Continue?`);
    if (!ok) return;
    onRemoveRow(index);
  };

  return (
    <div className="space-y-4">
      {!selectedHole ? (
        <div className="glass rounded-2xl border border-white/10 p-4 text-sm text-slate-300">Select a hole.</div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold text-slate-100">Downhole components</div>
              <div className="text-xs text-slate-400 truncate">
                Hole: <span className="text-slate-200">{selectedHole.hole_id}</span> . {rowCount} rows
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn h-10 min-h-0 px-4 text-xs" onClick={onAddRow} disabled={!canEdit}>
                Add component
              </button>
              <button
                type="button"
                className="btn btn-primary h-10 min-h-0 px-4 text-xs"
                onClick={onSave}
                disabled={!canEdit || componentSaving}
              >
                {componentSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          {componentLoading ? (
            <div className="glass rounded-xl border border-white/10 p-3 text-sm text-slate-300">Loading components...</div>
          ) : (componentTypesActive || []).length === 0 ? (
            <div className="glass rounded-xl border border-amber-300/30 p-3 text-sm text-amber-300">
              No active component types found for this org. Add or enable them in the <b>Types</b> tab.
            </div>
          ) : (
            <div className="space-y-3">
              {rowCount === 0 && (
                <div className="glass rounded-xl border border-white/10 p-3 text-xs italic text-slate-400">
                  No downhole components yet.
                </div>
              )}

              {(componentRows || []).map((r, idx) => {
                const t = r.component_type_id ? componentById?.get?.(r.component_type_id) : null;
                const swatch = t?.color || "#64748b";
                const schemaFields = Array.isArray(t?.details_schema?.fields) ? t.details_schema.fields : [];

                return (
                  <div key={r.id || `new-comp-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(110px,0.8fr)_minmax(0,1.8fr)_minmax(120px,0.9fr)_44px] gap-3 items-end">
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Depth (m)</label>
                        <input
                          className="input h-10 min-h-0 w-full"
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          value={r.depth_m}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { depth_m: e.target.value })}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Component Type</label>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: swatch }}
                            title={t?.name || "Component color"}
                          />
                          <select
                            className="select h-10 min-h-0 w-full"
                            value={r.component_type_id || ""}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateRow(idx, { component_type_id: e.target.value, details: {} })}
                          >
                            <option value="">Choose component type</option>
                            {(componentTypesActive || []).map((ct) => (
                              <option key={ct.id} value={ct.id}>
                                {ct.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Status</label>
                        <select
                          className="select h-10 min-h-0 w-full"
                          value={r.status || "installed"}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="h-10 min-h-0 w-full rounded-xl border border-rose-300/35 bg-rose-500/10 text-rose-200 transition-base hover:bg-rose-500/20 disabled:opacity-50 flex items-center justify-center"
                          onClick={() => confirmRemoveRow(idx, r, t)}
                          disabled={!canEdit}
                          title="Remove component"
                        >
                          X
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Category: {t?.category || "n/a"}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Icon: {t?.icon || "dot"}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Label</label>
                        <input
                          className="input h-10 min-h-0 w-full"
                          type="text"
                          placeholder="e.g. Logger-001"
                          value={r.label || ""}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { label: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Notes</label>
                        <input
                          className="input h-10 min-h-0 w-full"
                          type="text"
                          placeholder="Short note"
                          value={r.notes || ""}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateRow(idx, { notes: e.target.value })}
                        />
                      </div>
                    </div>

                    {schemaFields.length ? (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Component Details</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {schemaFields.map((field) => {
                            const fieldKey = field?.key;
                            if (!fieldKey) return null;
                            const fieldValue = r.details?.[fieldKey] ?? "";
                            const isBoolean = String(field?.type || "").toLowerCase() === "boolean";
                            return (
                              <div key={fieldKey} className={isBoolean ? "md:col-span-2" : ""}>
                                {!isBoolean ? (
                                  <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">{field?.label || fieldKey}</label>
                                ) : null}
                                {renderFieldInput(
                                  field,
                                  fieldValue,
                                  (nextValue) =>
                                    onUpdateRow(idx, {
                                      details: {
                                        ...(r.details || {}),
                                        [fieldKey]: nextValue,
                                      },
                                    }),
                                  !canEdit
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-3 text-xs text-slate-400">
                        This type does not have any configured detail fields yet. You can still save the basic depth, label, status, and notes.
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="text-xs text-slate-400">
                Rules: depth must be 0 or greater. Detail inputs are driven by the selected component type schema.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
