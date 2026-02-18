"use client";

import { useMemo, useState } from "react";

function SubTabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      className={[
        "btn btn-xs",
        active ? "btn-primary" : "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200",
      ].join(" ")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TypesList({
  title,
  description,
  canEdit,
  loading,
  saving,
  rows,
  onAdd,
  onSave,
  onUpdate,
  onDelete,
}) {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{title}</div>
          {description ? <div className="text-[11px] text-slate-400">{description}</div> : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button type="button" className="btn btn-xs" onClick={onAdd} disabled={!canEdit}>
            + Type
          </button>
          <button type="button" className="btn btn-xs btn-primary" onClick={onSave} disabled={!canEdit || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : (
        <div className="space-y-2">
          {(rows || []).length === 0 && <div className="text-xs text-slate-400 italic">No types yet. Click “+ Type”.</div>}

          {(rows || []).map((t, idx) => (
            <div key={t.id || `new-type-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <div className="flex flex-col gap-2 min-w-0 md:flex-row md:items-center md:justify-between">
                <input
                  className="input input-xs w-full min-w-0 md:flex-1"
                  placeholder="Type name"
                  value={t.name}
                  disabled={!canEdit}
                  onChange={(e) => onUpdate?.(idx, { name: e.target.value })}
                />

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Color</span>
                    <input
                      className="input input-xs"
                      type="color"
                      value={t.color || "#64748b"}
                      disabled={!canEdit}
                      onChange={(e) => onUpdate?.(idx, { color: e.target.value })}
                      title="Color"
                      style={{ width: 42, padding: 2 }}
                    />
                  </div>

                  <label className="text-xs text-slate-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={t.is_active !== false}
                      disabled={!canEdit}
                      onChange={(e) => onUpdate?.(idx, { is_active: e.target.checked })}
                    />
                    Active
                  </label>

                  <button
                    type="button"
                    className="btn btn-xs px-2 shrink-0"
                    onClick={() => onDelete?.(idx)}
                    disabled={!canEdit}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] text-slate-500">
        If delete fails, it’s likely referenced by intervals (FK) or blocked by RLS.
      </div>
    </div>
  );
}

export default function TypesTabs({
  myRole,
  canEdit,
  // lithology
  lithologyTypesAll,
  lithologyLoading,
  lithologySaving,
  onAddLithologyType,
  onSaveLithologyTypes,
  onUpdateLithologyType,
  onDeleteLithologyType,
  // construction
  constructionTypesAll,
  constructionLoading,
  constructionSaving,
  onAddConstructionType,
  onSaveConstructionTypes,
  onUpdateConstructionType,
  onDeleteConstructionType,
  // annulus
  annulusTypesAll,
  annulusLoading,
  annulusSaving,
  onAddAnnulusType,
  onSaveAnnulusTypes,
  onUpdateAnnulusType,
  onDeleteAnnulusType,
}) {
  const [subTab, setSubTab] = useState("geology");

  const header = useMemo(() => {
    if (subTab === "construction") return { title: "Construction" };
    if (subTab === "annulus") return { title: "Annulus" };
    return { title: "Geology" };
  }, [subTab]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">Types</div>
          <div className="text-[11px] text-slate-400 truncate">Section: {header.title}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SubTabButton active={subTab === "geology"} onClick={() => setSubTab("geology")} label="Geology" />
          <SubTabButton active={subTab === "construction"} onClick={() => setSubTab("construction")} label="Construction" />
          <SubTabButton active={subTab === "annulus"} onClick={() => setSubTab("annulus")} label="Annulus" />
        </div>
      </div>

      {subTab === "geology" ? (
        <TypesList
          title="Lithology types"
          description="Used by Geology intervals."
          canEdit={canEdit}
          loading={lithologyLoading}
          saving={lithologySaving}
          rows={lithologyTypesAll}
          onAdd={onAddLithologyType}
          onSave={onSaveLithologyTypes}
          onUpdate={onUpdateLithologyType}
          onDelete={onDeleteLithologyType}
        />
      ) : subTab === "construction" ? (
        <TypesList
          title="Construction types"
          description="Used by Construction intervals."
          canEdit={canEdit}
          loading={constructionLoading}
          saving={constructionSaving}
          rows={constructionTypesAll}
          onAdd={onAddConstructionType}
          onSave={onSaveConstructionTypes}
          onUpdate={onUpdateConstructionType}
          onDelete={onDeleteConstructionType}
        />
      ) : (
        <TypesList
          title="Annulus types"
          description="Used by Annulus intervals."
          canEdit={canEdit}
          loading={annulusLoading}
          saving={annulusSaving}
          rows={annulusTypesAll}
          onAdd={onAddAnnulusType}
          onSave={onSaveAnnulusTypes}
          onUpdate={onUpdateAnnulusType}
          onDelete={onDeleteAnnulusType}
        />
      )}
    </div>
  );
}
