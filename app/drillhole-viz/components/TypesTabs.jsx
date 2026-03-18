"use client";

import { useMemo, useState } from "react";
import HorizontalScrollTabs from "@/app/components/HorizontalScrollTabs";
import { LITHOLOGY_PATTERN_OPTIONS, normalizeLithologyPatternKey } from "../utils/lithologyPatterns";
import { COMPONENT_ICON_OPTIONS, ComponentIconSvg, getComponentIconOption } from "../utils/componentIcons";

const COMPONENT_CATEGORY_OPTIONS = ["sensor", "pump", "packer", "valve", "instrument", "other"];
const COMPONENT_FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "boolean", label: "Yes / No" },
];

function slugifyValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeComponentSchema(schema) {
  const source = schema && typeof schema === "object" && !Array.isArray(schema) ? schema : {};
  const fields = Array.isArray(source.fields)
    ? source.fields.map((field, index) => {
        const fieldType = String(field?.type || "text").toLowerCase();
        const normalizedType = COMPONENT_FIELD_TYPE_OPTIONS.some((option) => option.value === fieldType) ? fieldType : "text";
        const optionList = Array.isArray(field?.options)
          ? field.options
              .map((option) => {
                if (typeof option === "string") return option.trim();
                if (option?.value) return String(option.value).trim();
                return "";
              })
              .filter(Boolean)
          : [];

        return {
          key: String(field?.key || "").trim(),
          label: String(field?.label || field?.key || `Field ${index + 1}`).trim(),
          type: normalizedType,
          options: normalizedType === "select" ? optionList : [],
        };
      })
    : [];

  return {
    ...source,
    fields,
  };
}

function schemaToJson(schema) {
  return JSON.stringify(normalizeComponentSchema(schema), null, 2);
}

function updateComponentSchema(onUpdateComponentType, idx, schema) {
  const normalizedSchema = normalizeComponentSchema(schema);
  onUpdateComponentType?.(idx, {
    details_schema: normalizedSchema,
    details_schema_json: schemaToJson(normalizedSchema),
  });
}

function SubTabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      className={[
        "btn btn-xs shrink-0 whitespace-nowrap",
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
  showPatternSelect = false,
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
              {showPatternSelect ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      className="input input-xs w-full min-w-0 max-w-[420px]"
                      placeholder="Type name"
                      value={t.name}
                      disabled={!canEdit}
                      onChange={(e) => onUpdate?.(idx, { name: e.target.value })}
                    />

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

                  <div className="flex flex-wrap items-center gap-3">
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

                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Texture</span>
                      <select
                        className="select-gradient-sm min-w-[140px]"
                        value={normalizeLithologyPatternKey(t.pattern_key)}
                        disabled={!canEdit}
                        onChange={(e) => onUpdate?.(idx, { pattern_key: e.target.value })}
                      >
                        {LITHOLOGY_PATTERN_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs text-slate-300 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={t.is_active !== false}
                        disabled={!canEdit}
                        onChange={(e) => onUpdate?.(idx, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>
                </div>
              ) : (
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
              )}
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

function ComponentSchemaFieldRow({ field, index, canEdit, onUpdate, onRemove }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_160px_44px] xl:items-end">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Field Name</label>
          <input
            className="input input-xs w-full"
            placeholder="e.g. Model"
            value={field.label || ""}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ label: e.target.value, key: field.key || slugifyValue(e.target.value) })}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Answer Type</label>
          <select
            className="select-gradient-sm w-full"
            value={field.type || "text"}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ type: e.target.value, options: e.target.value === "select" ? field.options || [] : [] })}
          >
            {COMPONENT_FIELD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-xs px-2 shrink-0"
            onClick={onRemove}
            disabled={!canEdit}
            title={`Remove field ${index + 1}`}
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-slate-400">This becomes an extra input when someone adds this component to a hole.</div>
        <button
          type="button"
          className="text-[11px] text-slate-400 underline decoration-white/20 underline-offset-4 transition-base hover:text-slate-200"
          onClick={() => setShowAdvanced((current) => !current)}
          disabled={!canEdit}
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
      </div>

      {showAdvanced ? (
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Internal Key</label>
          <input
            className="input input-xs w-full font-mono"
            placeholder="e.g. model"
            value={field.key || ""}
            disabled={!canEdit}
            onChange={(e) => onUpdate({ key: slugifyValue(e.target.value) })}
          />
          <div className="mt-1 text-[11px] text-slate-500">Usually you can leave this alone. It is just the saved field name used behind the scenes.</div>
        </div>
      ) : null}

      {field.type === "select" ? (
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Dropdown Choices</label>
          <input
            className="input input-xs w-full"
            placeholder="Comma-separated choices, e.g. active, standby, retired"
            value={(field.options || []).join(", ")}
            disabled={!canEdit}
            onChange={(e) =>
              onUpdate({
                options: String(e.target.value || "")
                  .split(",")
                  .map((option) => option.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      ) : null}
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
  // components
  componentTypesAll,
  componentTypesLoading,
  componentTypesSaving,
  onAddComponentType,
  onSaveComponentTypes,
  onUpdateComponentType,
  onDeleteComponentType,
}) {
  const [subTab, setSubTab] = useState("geology");
  const [activeIconPickerKey, setActiveIconPickerKey] = useState("");

  const header = useMemo(() => {
    if (subTab === "construction") return { title: "Construction" };
    if (subTab === "annulus") return { title: "Annulus" };
    if (subTab === "components") return { title: "Components" };
    return { title: "Geology" };
  }, [subTab]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">Types</div>
          <div className="text-[11px] text-slate-400 truncate">Section: {header.title}</div>
        </div>

        <HorizontalScrollTabs className="sm:min-w-0" innerClassName="sm:min-w-0" hint="Swipe sections" hintClassName="text-slate-500">
            <SubTabButton active={subTab === "geology"} onClick={() => setSubTab("geology")} label="Geology" />
            <SubTabButton active={subTab === "construction"} onClick={() => setSubTab("construction")} label="Construction" />
            <SubTabButton active={subTab === "annulus"} onClick={() => setSubTab("annulus")} label="Annulus" />
            <SubTabButton active={subTab === "components"} onClick={() => setSubTab("components")} label="Components" />
        </HorizontalScrollTabs>
      </div>

      {subTab === "geology" ? (
        <TypesList
          title="Lithology types"
          description="Used by Geology intervals. Color remains primary, texture adds a second visual cue."
          canEdit={canEdit}
          loading={lithologyLoading}
          saving={lithologySaving}
          rows={lithologyTypesAll}
          showPatternSelect
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
      ) : subTab === "annulus" ? (
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
      ) : (
        <div className="card p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">Component types</div>
              <div className="text-[11px] text-slate-400">Used by the Components tab and schematic markers.</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn btn-xs" onClick={onAddComponentType} disabled={!canEdit}>
                + Type
              </button>
              <button type="button" className="btn btn-xs btn-primary" onClick={onSaveComponentTypes} disabled={!canEdit || componentTypesSaving}>
                {componentTypesSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {componentTypesLoading ? (
            <div className="text-sm text-slate-300">Loading…</div>
          ) : (
            <div className="space-y-2">
              {(componentTypesAll || []).length === 0 && <div className="text-xs text-slate-400 italic">No component types yet. Click "+ Type".</div>}

              {(componentTypesAll || []).map((t, idx) => (
                <div key={t.id || `new-component-type-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-4">
                  {(() => {
                    const selectedIconOption = getComponentIconOption(t.icon);
                    const iconPickerKey = String(t.id || `new-${idx}`);
                    const isIconPickerOpen = activeIconPickerKey === iconPickerKey;
                    return (
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Name</label>
                          <input
                            className="input input-xs w-full min-w-0"
                            placeholder="Type name"
                            value={t.name}
                            disabled={!canEdit}
                            onChange={(e) =>
                              onUpdateComponentType?.(idx, {
                                name: e.target.value,
                                key: t.id ? t.key : slugifyValue(e.target.value),
                              })
                            }
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Category</label>
                          <select
                            className="select-gradient-sm w-full max-w-[280px]"
                            value={t.category || "sensor"}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateComponentType?.(idx, { category: e.target.value })}
                          >
                            {COMPONENT_CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="relative">
                          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Icon</div>
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-slate-200 transition-base hover:bg-white/[0.06] hover:border-white/20"
                            onClick={() => setActiveIconPickerKey((current) => (current === iconPickerKey ? "" : iconPickerKey))}
                            disabled={!canEdit}
                            aria-expanded={isIconPickerOpen}
                            aria-label="Choose component icon"
                          >
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-slate-950/50">
                              <ComponentIconSvg icon={selectedIconOption.value} color={t.color || "#38bdf8"} size={28} glyphScale={1.45} />
                            </div>
                            <span className="text-xs text-slate-400">Select</span>
                          </button>

                          {isIconPickerOpen ? (
                            <div className="absolute left-0 top-full z-20 mt-2 w-[244px] rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
                              <div className="grid grid-cols-4 gap-2">
                                {COMPONENT_ICON_OPTIONS.map((option) => {
                                  const isSelected = option.value === selectedIconOption.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={[
                                        "flex h-14 w-14 items-center justify-center rounded-xl border transition-base",
                                        isSelected
                                          ? "border-sky-300/60 bg-sky-500/12 shadow-[0_0_0_1px_rgba(125,211,252,0.18)]"
                                          : "border-white/10 bg-slate-900/70 hover:bg-white/[0.06] hover:border-white/20",
                                      ].join(" ")}
                                      onClick={() => {
                                        onUpdateComponentType?.(idx, { icon: option.value });
                                        setActiveIconPickerKey("");
                                      }}
                                      disabled={!canEdit}
                                      aria-pressed={isSelected}
                                      aria-label={option.label}
                                      title={option.label}
                                    >
                                      <ComponentIconSvg icon={option.value} color={t.color || "#38bdf8"} size={34} selected={isSelected} glyphScale={1.62} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Color</span>
                          <input
                            className="input input-xs"
                            type="color"
                            value={t.color || "#38bdf8"}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateComponentType?.(idx, { color: e.target.value })}
                            title="Color"
                            style={{ width: 42, padding: 2 }}
                          />
                        </div>

                        <label className="text-xs text-slate-300 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={t.is_active !== false}
                            disabled={!canEdit}
                            onChange={(e) => onUpdateComponentType?.(idx, { is_active: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-xs px-2 shrink-0"
                      onClick={() => onDeleteComponentType?.(idx)}
                      disabled={!canEdit}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                    );
                  })()}

                  <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-100">Extra details to capture</div>
                        <div className="text-[11px] text-slate-400">Add any extra questions you want users to fill in for this component type.</div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => {
                          const schema = normalizeComponentSchema(t.details_schema);
                          updateComponentSchema(onUpdateComponentType, idx, {
                            ...schema,
                            fields: [
                              ...(schema.fields || []),
                              {
                                key: "",
                                label: `Field ${(schema.fields || []).length + 1}`,
                                type: "text",
                                options: [],
                              },
                            ],
                          });
                        }}
                        disabled={!canEdit}
                      >
                        + Detail
                      </button>
                    </div>

                    {normalizeComponentSchema(t.details_schema).fields.length ? (
                      <div className="space-y-3">
                        {normalizeComponentSchema(t.details_schema).fields.map((field, fieldIdx) => (
                          <ComponentSchemaFieldRow
                            key={`${t.id || idx}-field-${fieldIdx}`}
                            field={field}
                            index={fieldIdx}
                            canEdit={canEdit}
                            onUpdate={(patch) => {
                              const schema = normalizeComponentSchema(t.details_schema);
                              const nextFields = [...schema.fields];
                              nextFields[fieldIdx] = {
                                ...nextFields[fieldIdx],
                                ...patch,
                              };
                              if (patch.label && !nextFields[fieldIdx].key) {
                                nextFields[fieldIdx].key = slugifyValue(patch.label);
                              }
                              updateComponentSchema(onUpdateComponentType, idx, {
                                ...schema,
                                fields: nextFields,
                              });
                            }}
                            onRemove={() => {
                              const schema = normalizeComponentSchema(t.details_schema);
                              updateComponentSchema(onUpdateComponentType, idx, {
                                ...schema,
                                fields: schema.fields.filter((_, currentFieldIdx) => currentFieldIdx !== fieldIdx),
                              });
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-3 text-xs text-slate-400">
                        No extra details yet. Add a detail here if this component should capture things like model, serial number, install date, or a dropdown status.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Component names, icons, and extra details are saved for reuse in the Components tab and schematic view.
          </div>
        </div>
      )}
    </div>
  );
}
