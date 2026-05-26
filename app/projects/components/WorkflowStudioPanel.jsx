"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  DEFAULT_WORKFLOW_COLOR,
  WORKFLOW_ENTITY_OPTIONS,
  formatWorkflowPhaseLabel,
  formatWorkflowSubstageLabel,
  getWorkflowBadgeStyle,
  normalizeWorkflows,
  slugifyWorkflowKey,
} from "@/lib/workflows";

const EMPTY_WORKFLOW_FORM = {
  entity_type: "project",
  name: "",
  key: "",
  description: "",
  color: DEFAULT_WORKFLOW_COLOR,
  sort_order: "",
  is_active: true,
};

const EMPTY_PHASE_FORM = {
  name: "",
  description: "",
};

const EMPTY_SUBSTAGE_FORM = {
  name: "",
  description: "",
};

function WorkflowModal({ form, setForm, saving, onClose, onSave, editing }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{editing ? "Edit workflow" : "Create workflow"}</h3>
            <p className="mt-1 text-sm text-slate-400">Reusable templates for projects or holes.</p>
          </div>
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            Applies to
            <select className="select-gradient-sm mt-1 w-full" value={form.entity_type} onChange={(e) => setForm((prev) => ({ ...prev, entity_type: e.target.value }))}>
              {WORKFLOW_ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-200">
            Workflow name
            <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Exploration delivery" />
          </label>

          <label className="text-sm text-slate-200">
            Machine key
            <input className="input mt-1 w-full font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="exploration_delivery" />
          </label>

          <label className="text-sm text-slate-200">
            Sort order
            <input className="input mt-1 w-full" type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} placeholder="10" />
          </label>

          <label className="text-sm text-slate-200 md:col-span-2">
            Description
            <textarea className="textarea mt-1 w-full" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What this workflow is intended to manage." />
          </label>

          <label className="text-sm text-slate-200">
            Accent color
            <div className="mt-1 flex items-center gap-3">
              <input className="h-10 w-14 rounded border border-white/10 bg-transparent p-1" type="color" value={form.color || DEFAULT_WORKFLOW_COLOR} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
              <input className="input w-full" value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} placeholder="#38bdf8" />
            </div>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200 md:self-end">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
            Active and assignable
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : editing ? "Save workflow" : "Create workflow"}</button>
        </div>
      </div>
    </div>
  );
}

function PhaseModal({
  phase,
  form,
  setForm,
  saving,
  onClose,
  onSave,
  workflowName,
  substageForm,
  setSubstageForm,
  savingSubstage,
  editingSubstageId,
  targetSubstageIndex,
  onCreateSubstage,
  onEditSubstage,
  onSaveSubstage,
  onDeleteSubstage,
  onMoveSubstage,
  movingSubstageId,
}) {
  const phaseIndex = phase?.phase_index || 0;
  const hasPhaseName = String(form.name || "").trim().length > 0;
  const substageCount = phase?.substages?.length || 0;
  const substageLimitReached = !editingSubstageId && substageCount >= 5;
  const activeSubstageLabel = targetSubstageIndex ? `S${targetSubstageIndex}` : "Choose a slot";
  const [activeEditor, setActiveEditor] = useState(null);

  useEffect(() => {
    if (editingSubstageId || targetSubstageIndex) {
      setActiveEditor("substage");
    }
  }, [editingSubstageId, targetSubstageIndex]);

  const closeInlineEditor = () => {
    setActiveEditor(null);
    if (editingSubstageId || targetSubstageIndex) {
      setSubstageForm(EMPTY_SUBSTAGE_FORM);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-0 shadow-[0_30px_100px_rgba(2,6,23,0.52)]">
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Phase Editor</div>
              <h3 className="mt-2 text-xl font-semibold text-slate-100">{workflowName ? `${workflowName} · Phase ${phaseIndex}` : `Phase ${phaseIndex}`}</h3>
              <p className="mt-1 text-sm text-slate-400">Configure the main stage and manage all substages in one place.</p>
            </div>
            <button type="button" className="btn btn-3d-glass self-start" onClick={onClose} disabled={saving || savingSubstage}>Close</button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-5 md:p-6">
          <div className="space-y-5">
            <WorkflowStudioPhaseBlueprint
              phase={phase}
              phaseName={form.name}
              phaseDescription={form.description}
              activeSubstageIndex={targetSubstageIndex}
              onSelectStage={() => setActiveEditor("stage")}
              onSelectSubstageSlot={(slotNumber, substage) => {
                if (substage) {
                  onEditSubstage(substage);
                } else {
                  onCreateSubstage(slotNumber);
                }
                setActiveEditor("substage");
              }}
            />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(15,23,42,0.42))] p-4 md:p-5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/75">Interactive Editing</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Click the main stage node to edit the phase. Click any substage tile, including an open slot, to edit that exact item in a pop-up.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-3d-glass" onClick={() => setActiveEditor("stage")}>
                    Edit stage
                  </button>
                  <button type="button" className="btn btn-3d-glass" onClick={() => { onCreateSubstage(); setActiveEditor("substage"); }} disabled={!hasPhaseName || savingSubstage || substageLimitReached}>
                    New substage
                  </button>
                  <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">{activeSubstageLabel}</span>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Substages</div>
                    <div className="mt-1 text-sm text-slate-300">Order, edit, and prune the substages tied to this main stage.</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">{substageCount}/5 configured</span>
                </div>

                <div className="mt-5">
                  <SubstageList
                    substages={phase?.substages || []}
                    onMove={(substageId, direction) => void onMoveSubstage(substageId, direction)}
                    movingSubstageId={movingSubstageId}
                    onEdit={onEditSubstage}
                    onDelete={(substage) => void onDeleteSubstage(substage)}
                  />
                </div>
              </div>
            </div>

            {activeEditor === "stage" ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={closeInlineEditor}>
                <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.5)]" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/75">Edit Stage</div>
                      <div className="mt-1 text-sm text-slate-300">Stage {phaseIndex}</div>
                    </div>
                    <button type="button" className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={closeInlineEditor}>Close</button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="text-sm text-slate-200">
                      Phase name
                      <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Planned" />
                    </label>
                    <label className="text-sm text-slate-200">
                      Description
                      <textarea className="textarea mt-1 w-full" rows={5} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What this phase means operationally." />
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="btn btn-3d-glass" onClick={closeInlineEditor} disabled={saving}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={async () => { await onSave(); setActiveEditor(null); }} disabled={saving || savingSubstage}>{saving ? "Saving..." : "Save stage"}</button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeEditor === "substage" ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={closeInlineEditor}>
                <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.5)]" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/75">Edit Substage</div>
                      <div className="mt-1 text-sm text-slate-300">{activeSubstageLabel}</div>
                    </div>
                    <button type="button" className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={closeInlineEditor}>Close</button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="text-sm text-slate-200">
                      {editingSubstageId ? `Edit ${activeSubstageLabel} name` : `New ${activeSubstageLabel} name`}
                      <input
                        className="input mt-1 w-full"
                        value={substageForm.name}
                        onChange={(e) => setSubstageForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Awaiting approvals"
                        disabled={!hasPhaseName || substageLimitReached}
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Description
                      <textarea
                        className="textarea mt-1 w-full"
                        rows={4}
                        value={substageForm.description}
                        onChange={(e) => setSubstageForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="What the team should understand about this substage."
                        disabled={!hasPhaseName || substageLimitReached}
                      />
                    </label>
                  </div>
                  {!hasPhaseName ? <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Name the stage first, then add substages.</div> : null}
                  {substageLimitReached ? <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300">This stage already has all 5 substages filled.</div> : null}
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="btn btn-3d-glass" onClick={closeInlineEditor} disabled={savingSubstage}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={async () => { await onSaveSubstage(); setActiveEditor(null); }} disabled={saving || savingSubstage || !hasPhaseName || substageLimitReached || !substageForm.name.trim()}>
                      {savingSubstage ? "Saving..." : editingSubstageId ? "Save substage" : "Add substage"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowBadge({ color, children }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium" style={getWorkflowBadgeStyle(color)}>{children}</span>;
}

const WORKFLOW_STUDIO_STAGE_META = {
  complete: {
    ringClassName: "border-emerald-300/45 text-emerald-300 shadow-[0_0_24px_rgba(74,222,128,0.18)]",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-emerald-200/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.95),rgba(5,150,105,0.82))] text-white",
    chipClassName: "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
  },
  planned: {
    ringClassName: "border-orange-300/45 text-orange-300 shadow-[0_0_24px_rgba(249,115,22,0.16)]",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-orange-200/20 bg-[linear-gradient(145deg,rgba(249,115,22,0.95),rgba(234,88,12,0.82))] text-white",
    chipClassName: "border-orange-300/20 bg-orange-400/10 text-orange-50",
  },
  not_started: {
    ringClassName: "border-slate-400/30 text-slate-300",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.12),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-white/10 bg-[linear-gradient(145deg,rgba(100,116,139,0.92),rgba(51,65,85,0.88))] text-white",
    chipClassName: "border-white/10 bg-white/[0.05] text-slate-200",
  },
};

function getWorkflowStudioStageMeta(phase) {
  const named = String(phase?.name || "").trim().length > 0;
  if (!named) return WORKFLOW_STUDIO_STAGE_META.not_started;
  if ((phase?.substages?.length || 0) > 0) return WORKFLOW_STUDIO_STAGE_META.complete;
  return WORKFLOW_STUDIO_STAGE_META.planned;
}

function WorkflowStudioStageIcon({ configured, className = "" }) {
  const sharedProps = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
  };

  if (configured) {
    return (
      <svg {...sharedProps}>
        <path d="M5 12.5l4.2 4.2L19 7.8" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <path d="M8 12h8" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function WorkflowStudioStageStrip({ phases, selectedPhaseId, onSelectPhase }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,47,73,0.22),rgba(15,23,42,0.82),rgba(30,41,59,0.52))] px-1.5 py-2.5 shadow-[0_18px_50px_rgba(2,6,23,0.28)] md:p-3">
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-1.5 py-3 md:px-3">
        <div className="grid grid-cols-5 gap-2 md:gap-2.5">
          {phases.map((phase, index) => {
            const stageNumber = index + 1;
            const stageMeta = getWorkflowStudioStageMeta(phase);
            const isSelected = selectedPhaseId === phase.id;
            const hasSubstages = (phase?.substages?.length || 0) > 0;

            return (
              <div key={phase.id} className="relative flex flex-col items-center text-center">
                {stageNumber < 5 ? (
                  <div className="pointer-events-none absolute left-[calc(50%+2rem)] right-[-18%] top-[2rem] hidden h-px md:block">
                    <div className="relative h-px w-full bg-gradient-to-r from-white/0 via-white/15 to-white/0">
                      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-slate-300/70" />
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => onSelectPhase(phase.id)}
                  data-pressable="true"
                  data-actionable="true"
                  className="map-workflow-stagegate group relative flex w-full flex-col items-center text-center"
                >
                  <div
                    className={[
                      "map-workflow-stagegate-orb relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-[4px] bg-transparent transition-base md:h-[60px] md:w-[60px] lg:h-[64px] lg:w-[64px]",
                      stageMeta.ringClassName,
                      isSelected
                        ? "scale-[1.05] shadow-[0_0_0_6px_rgba(34,211,238,0.18),0_0_0_12px_rgba(34,211,238,0.08)]"
                        : "group-hover:scale-[1.02]",
                    ].join(" ")}
                  >
                    {isSelected ? <span className="pointer-events-none absolute inset-[-8px] rounded-full border border-cyan-300/25" /> : null}
                    <span className="absolute -top-1 h-2 w-2 rounded-full bg-current opacity-85" />
                    <div className={[
                      "relative flex h-[40px] w-[40px] flex-col items-center justify-center rounded-full border text-center md:h-[46px] md:w-[46px] lg:h-[50px] lg:w-[50px]",
                      stageMeta.coreClassName,
                    ].join(" ")}>
                      <span className="pointer-events-none absolute inset-[14%] rounded-full border border-white/8" />
                      <span className={[
                        "relative flex h-6 w-6 items-center justify-center rounded-xl border md:h-7 md:w-7 lg:h-8 lg:w-8",
                        stageMeta.badgeClassName,
                      ].join(" ")}>
                        <WorkflowStudioStageIcon configured={hasSubstages} className="h-3.5 w-3.5 md:h-4 md:w-4 lg:h-4.5 lg:w-4.5" />
                      </span>
                    </div>
                  </div>

                  <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-medium uppercase tracking-[0.16em] md:px-2.5 md:text-[9px] ${stageMeta.chipClassName}`}>
                    Stage {stageNumber}
                  </div>
                  <div
                    className={[
                      "mt-1.5 h-[2.3em] w-full min-w-0 max-w-[58px] overflow-hidden text-center text-[8px] font-semibold leading-[1.15] whitespace-normal break-words md:h-[2.3em] md:max-w-[92px] md:text-[9px] lg:h-[2.3em] lg:max-w-[108px] lg:text-[9px]",
                      isSelected ? "text-cyan-50" : "text-white",
                    ].join(" ")}
                    title={phase?.name || "Unused"}
                  >
                    {phase?.name || "Unused"}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkflowStudioPhaseBlueprint({ phase, phaseName, phaseDescription, activeSubstageIndex, onSelectStage, onSelectSubstageSlot }) {
  const named = String(phaseName || "").trim().length > 0;
  const stageMeta = getWorkflowStudioStageMeta({ ...phase, name: phaseName });
  const substages = [...(phase?.substages || [])].sort((left, right) => (Number(left?.substage_index) || 0) - (Number(right?.substage_index) || 0));

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.9),rgba(2,6,23,0.98))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.28)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/75">Stage Blueprint</div>
          <div className="mt-1 text-sm text-slate-300">Main stage above, substages beneath, with empty slots still visible.</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
          {(substages.length || 0)}/5 substages
        </span>
      </div>

      <div className="relative mt-6 flex flex-col items-center">
        <button type="button" onClick={onSelectStage} className="relative flex flex-col items-center text-center transition hover:scale-[1.01]">
          <div className={[
            "relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] bg-transparent md:h-[84px] md:w-[84px]",
            stageMeta.ringClassName,
          ].join(" ")}>
            <span className="absolute inset-[-10px] rounded-full border border-cyan-300/15" />
            <span className="absolute -top-1.5 h-2.5 w-2.5 rounded-full bg-current opacity-85" />
            <div className={[
              "relative flex h-[56px] w-[56px] items-center justify-center rounded-full border md:h-[64px] md:w-[64px]",
              stageMeta.coreClassName,
            ].join(" ")}>
              <span className="pointer-events-none absolute inset-[14%] rounded-full border border-white/8" />
              <span className={[
                "relative flex h-9 w-9 items-center justify-center rounded-2xl border md:h-10 md:w-10",
                stageMeta.badgeClassName,
              ].join(" ")}>
                <WorkflowStudioStageIcon configured={substages.length > 0} className="h-5 w-5" />
              </span>
            </div>
          </div>

          <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] md:text-[11px] ${stageMeta.chipClassName}`}>
            Stage {phase?.phase_index || 0}
          </div>
          <div className="mt-2 max-w-[220px] text-center text-sm font-semibold leading-5 text-white md:text-base">
            {named ? phaseName : "Unnamed stage"}
          </div>
          <div className="mt-1 max-w-[320px] text-center text-xs leading-5 text-slate-400 md:text-sm">
            {phaseDescription || (named ? "Add a short description to guide the team through this stage." : "Name this stage to unlock and structure its substages.")}
          </div>
        </button>

        <div className="mt-4 h-10 w-px bg-[linear-gradient(180deg,rgba(34,211,238,0.55),rgba(148,163,184,0.08))]" />

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => {
            const slotNumber = index + 1;
            const substage = substages.find((item) => Number(item?.substage_index) === slotNumber) || null;
            const isSelected = activeSubstageIndex === slotNumber;

            return (
              <button
                key={substage?.id || `phase-blueprint-slot-${slotNumber}`}
                type="button"
                onClick={() => onSelectSubstageSlot(slotNumber, substage)}
                className={[
                  "group relative overflow-hidden rounded-[22px] border p-3 text-left transition-base",
                  substage
                    ? isSelected
                      ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(15,23,42,0.94))] shadow-[0_16px_36px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-white/[0.04] hover:border-cyan-300/25 hover:bg-white/[0.06]"
                    : "border-dashed border-white/10 bg-white/[0.02] opacity-70",
                ].join(" ")}
              >
                <div className="pointer-events-none absolute left-1/2 top-0 h-4 w-px -translate-y-full bg-[linear-gradient(180deg,rgba(34,211,238,0.38),rgba(255,255,255,0))]" />
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    S{slotNumber}
                  </span>
                  <span className={[
                    "h-2.5 w-2.5 rounded-full",
                    substage ? (isSelected ? "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.6)]" : "bg-emerald-300/85") : "bg-slate-500/65",
                  ].join(" ")} />
                </div>
                <div className="mt-3 min-h-[2.5rem] text-sm font-semibold leading-5 text-white">
                  {substage ? formatWorkflowSubstageLabel(substage) : "Open slot"}
                </div>
                <div className="mt-1 min-h-[3rem] text-xs leading-5 text-slate-400">
                  {substage ? (substage.description || "No description yet.") : "Add another substage here to complete the flow."}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IconMoveUp(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10 15V5" />
      <path d="m5.5 9.5 4.5-4.5 4.5 4.5" />
    </svg>
  );
}

function IconMoveDown(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10 5v10" />
      <path d="m5.5 10.5 4.5 4.5 4.5-4.5" />
    </svg>
  );
}

function PhaseSlotCard({ phase, selected, onOpen }) {
  const named = String(phase?.name || "").trim().length > 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(phase)}
      className={[
        "rounded-[24px] border p-4 text-left transition-base",
        selected ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(15,23,42,0.94))]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Phase {phase.phase_index}</div>
          <div className="mt-2 text-base font-semibold text-white">{named ? phase.name : "Unused phase"}</div>
          <div className="mt-2 text-sm text-slate-300/75">{phase.description || (named ? "No description yet." : "Leave blank if this workflow does not need this phase.")}</div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">{phase.substages?.length || 0} substage{phase.substages?.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-4 flex justify-end">
        <span className="btn btn-3d-glass px-3 py-1.5 text-xs">
          {named ? "Open editor" : "Name stage"}
        </span>
      </div>
    </button>
  );
}

function SubstageList({ substages, onMove, movingSubstageId, onEdit, onDelete }) {
  if (!substages.length) {
    return <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">No substages configured for this phase.</div>;
  }

  return (
    <div className="space-y-3">
      {substages.map((substage, index) => (
        <div key={substage.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Substage {substage.substage_index}</div>
              <div className="mt-1 text-base font-semibold text-white">{formatWorkflowSubstageLabel(substage)}</div>
              <div className="mt-2 text-sm text-slate-300/80">{substage.description || "No description yet."}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-3d-glass px-3 py-1.5 text-xs"
                onClick={() => onMove(substage.id, -1)}
                disabled={movingSubstageId === substage.id || index === 0}
                aria-label="Move substage up"
                title="Move up"
              >
                <IconMoveUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-3d-glass px-3 py-1.5 text-xs"
                onClick={() => onMove(substage.id, 1)}
                disabled={movingSubstageId === substage.id || index === substages.length - 1}
                aria-label="Move substage down"
                title="Move down"
              >
                <IconMoveDown className="h-4 w-4" />
              </button>
              <button type="button" className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={() => onEdit(substage)}>Edit</button>
              <button type="button" className="btn btn-danger px-3 py-1.5 text-xs" onClick={() => onDelete(substage)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkflowStudioPanel({ orgId, onChange }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [entityType, setEntityType] = useState("project");
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState(null);
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [editingSubstageId, setEditingSubstageId] = useState(null);
  const [targetSubstageIndex, setTargetSubstageIndex] = useState(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [savingPhase, setSavingPhase] = useState(false);
  const [savingSubstage, setSavingSubstage] = useState(false);
  const [movingSubstageId, setMovingSubstageId] = useState("");
  const [workflowForm, setWorkflowForm] = useState(EMPTY_WORKFLOW_FORM);
  const [phaseForm, setPhaseForm] = useState(EMPTY_PHASE_FORM);
  const [substageForm, setSubstageForm] = useState(EMPTY_SUBSTAGE_FORM);

  const loadWorkflows = async () => {
    if (!orgId) {
      setWorkflows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [workflowRes, phaseRes, substageRes] = await Promise.all([
      supabase.from("workflow_definitions").select("id, organization_id, entity_type, key, name, description, color, sort_order, is_active, created_at").eq("organization_id", orgId),
      supabase.from("workflow_phase_definitions").select("id, workflow_id, phase_index, name, description, created_at"),
      supabase.from("workflow_substage_definitions").select("id, workflow_phase_id, substage_index, name, description, created_at"),
    ]);

    if (workflowRes.error) {
      toast.error(workflowRes.error.message || "Failed to load workflows");
      setWorkflows([]);
      setLoading(false);
      return;
    }

    if (phaseRes.error) {
      toast.error(phaseRes.error.message || "Failed to load workflow phases");
      setWorkflows([]);
      setLoading(false);
      return;
    }

    if (substageRes.error) {
      toast.error(substageRes.error.message || "Failed to load workflow substages");
      setWorkflows([]);
      setLoading(false);
      return;
    }

    setWorkflows(normalizeWorkflows(workflowRes.data || [], phaseRes.data || [], substageRes.data || []));
    setLoading(false);
  };

  useEffect(() => {
    void loadWorkflows();
  }, [orgId]);

  const filteredWorkflows = useMemo(() => workflows.filter((workflow) => workflow.entity_type === entityType), [entityType, workflows]);

  useEffect(() => {
    if (!filteredWorkflows.length) {
      setSelectedWorkflowId("");
      return;
    }

    if (!filteredWorkflows.some((workflow) => workflow.id === selectedWorkflowId)) {
      setSelectedWorkflowId(filteredWorkflows[0].id);
    }
  }, [filteredWorkflows, selectedWorkflowId]);

  const selectedWorkflow = useMemo(() => filteredWorkflows.find((workflow) => workflow.id === selectedWorkflowId) || null, [filteredWorkflows, selectedWorkflowId]);

  useEffect(() => {
    if (!selectedWorkflow?.phases?.length) {
      setSelectedPhaseId("");
      return;
    }

    if (!selectedWorkflow.phases.some((phase) => phase.id === selectedPhaseId)) {
      setSelectedPhaseId(selectedWorkflow.phases[0].id);
    }
  }, [selectedPhaseId, selectedWorkflow]);

  const selectedPhase = useMemo(() => selectedWorkflow?.phases.find((phase) => phase.id === selectedPhaseId) || null, [selectedPhaseId, selectedWorkflow]);

  const openCreateWorkflow = () => {
    setEditingWorkflowId(null);
    setWorkflowForm({ ...EMPTY_WORKFLOW_FORM, entity_type: entityType });
    setShowWorkflowModal(true);
  };

  const openEditWorkflow = (workflow) => {
    setEditingWorkflowId(workflow.id);
    setWorkflowForm({
      entity_type: workflow.entity_type,
      name: workflow.name || "",
      key: workflow.key || "",
      description: workflow.description || "",
      color: workflow.color || DEFAULT_WORKFLOW_COLOR,
      sort_order: String(workflow.sort_order ?? ""),
      is_active: workflow.is_active !== false,
    });
    setShowWorkflowModal(true);
  };

  const saveWorkflow = async () => {
    if (!orgId) return toast.error("Organisation not ready");
    const key = slugifyWorkflowKey(workflowForm.key || workflowForm.name);
    if (!key) return toast.error("Workflow key is required");

    setSavingWorkflow(true);
    const payload = {
      entity_type: workflowForm.entity_type,
      name: workflowForm.name.trim(),
      key,
      description: workflowForm.description.trim() || null,
      color: workflowForm.color || null,
      sort_order: workflowForm.sort_order === "" ? 0 : Number(workflowForm.sort_order),
      is_active: !!workflowForm.is_active,
    };

    const { error } = editingWorkflowId
      ? await supabase.from("workflow_definitions").update(payload).eq("id", editingWorkflowId)
      : await supabase.from("workflow_definitions").insert({ ...payload, organization_id: orgId });

    setSavingWorkflow(false);

    if (error) {
      toast.error(error.message || "Failed to save workflow");
      return;
    }

    toast.success(editingWorkflowId ? "Workflow updated" : "Workflow created");
    setShowWorkflowModal(false);
    setEditingWorkflowId(null);
    await loadWorkflows();
    await onChange?.();
  };

  const toggleWorkflowActive = async (workflow) => {
    const { error } = await supabase.from("workflow_definitions").update({ is_active: !workflow.is_active }).eq("id", workflow.id);
    if (error) return toast.error(error.message || "Failed to update workflow");
    toast.success(workflow.is_active ? "Workflow archived" : "Workflow reactivated");
    await loadWorkflows();
    await onChange?.();
  };

  const deleteWorkflow = async (workflow) => {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This will remove all phases and substages.`)) return;
    const { error } = await supabase.from("workflow_definitions").delete().eq("id", workflow.id);
    if (error) return toast.error(error.message || "Failed to delete workflow");
    toast.success("Workflow deleted");
    await loadWorkflows();
    await onChange?.();
  };

  const openEditPhase = (phase) => {
    setEditingPhaseId(phase.id);
    setSelectedPhaseId(phase.id);
    setPhaseForm({
      name: phase.name || "",
      description: phase.description || "",
    });
    setEditingSubstageId(null);
    setTargetSubstageIndex(null);
    setSubstageForm(EMPTY_SUBSTAGE_FORM);
    setShowPhaseModal(true);
  };

  const closePhaseModal = () => {
    setShowPhaseModal(false);
    setEditingPhaseId(null);
    setEditingSubstageId(null);
    setTargetSubstageIndex(null);
    setSubstageForm(EMPTY_SUBSTAGE_FORM);
  };

  const savePhase = async () => {
    if (!editingPhaseId) return toast.error("Select a phase first");
    setSavingPhase(true);

    const payload = {
      name: phaseForm.name.trim() || null,
      description: phaseForm.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error: phaseError } = await supabase.from("workflow_phase_definitions").update(payload).eq("id", editingPhaseId);
    if (phaseError) {
      setSavingPhase(false);
      toast.error(phaseError.message || "Failed to save phase");
      return;
    }

    if (!phaseForm.name.trim()) {
      const { error: deleteError } = await supabase.from("workflow_substage_definitions").delete().eq("workflow_phase_id", editingPhaseId);
      if (deleteError) {
        setSavingPhase(false);
        toast.error(deleteError.message || "Failed to clear phase substages");
        return;
      }

      setEditingSubstageId(null);
      setTargetSubstageIndex(null);
      setSubstageForm(EMPTY_SUBSTAGE_FORM);
    }

    setSavingPhase(false);
    setPhaseForm({
      name: phaseForm.name.trim(),
      description: phaseForm.description.trim(),
    });
    toast.success("Stage saved");
    await loadWorkflows();
    await onChange?.();
  };

  const openCreateSubstage = (slotNumber = null) => {
    if (!selectedPhase) return;
    if (!String(selectedPhase.name || "").trim()) {
      toast.error("Name the phase before adding substages");
      return;
    }
    if ((selectedPhase.substages?.length || 0) >= 5) {
      toast.error("Each phase can only have 5 substages");
      return;
    }
    const usedIndexes = new Set((selectedPhase.substages || []).map((substage) => Number(substage.substage_index)));
    const nextIndex = slotNumber || [1, 2, 3, 4, 5].find((index) => !usedIndexes.has(index)) || null;
    if (!nextIndex) {
      toast.error("No substage slots left in this phase");
      return;
    }
    if (usedIndexes.has(nextIndex)) {
      const existingSubstage = (selectedPhase.substages || []).find((substage) => Number(substage.substage_index) === nextIndex);
      if (existingSubstage) {
        openEditSubstage(existingSubstage);
      }
      return;
    }
    setEditingSubstageId(null);
    setTargetSubstageIndex(nextIndex);
    setSubstageForm(EMPTY_SUBSTAGE_FORM);
  };

  const openEditSubstage = (substage) => {
    setEditingSubstageId(substage.id);
    setTargetSubstageIndex(Number(substage.substage_index) || null);
    setSubstageForm({
      name: substage.name || "",
      description: substage.description || "",
    });
  };

  const saveSubstage = async () => {
    if (!selectedPhase) return toast.error("Select a phase first");
    if (!String(selectedPhase.name || "").trim()) return toast.error("Name the phase first");
    if (!substageForm.name.trim()) return toast.error("Substage name is required");

    setSavingSubstage(true);
    const payload = {
      workflow_phase_id: selectedPhase.id,
      name: substageForm.name.trim(),
      description: substageForm.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error = null;
    if (editingSubstageId) {
      ({ error } = await supabase.from("workflow_substage_definitions").update(payload).eq("id", editingSubstageId));
    } else {
      const usedIndexes = new Set((selectedPhase.substages || []).map((substage) => Number(substage.substage_index)));
      const nextIndex = targetSubstageIndex || [1, 2, 3, 4, 5].find((index) => !usedIndexes.has(index)) || null;
      if (!nextIndex) {
        setSavingSubstage(false);
        toast.error("No substage slots left in this phase");
        return;
      }
      ({ error } = await supabase.from("workflow_substage_definitions").insert({ ...payload, substage_index: nextIndex }));
    }

    setSavingSubstage(false);

    if (error) {
      toast.error(error.message || "Failed to save substage");
      return;
    }

    toast.success(editingSubstageId ? "Substage updated" : "Substage created");
    setEditingSubstageId(null);
    setTargetSubstageIndex(null);
    setSubstageForm(EMPTY_SUBSTAGE_FORM);
    await loadWorkflows();
    await onChange?.();
  };

  const deleteSubstage = async (substage) => {
    if (!window.confirm(`Delete substage "${substage.name}"?`)) return;
    const { error } = await supabase.from("workflow_substage_definitions").delete().eq("id", substage.id);
    if (error) return toast.error(error.message || "Failed to delete substage");
    toast.success("Substage deleted");
    await loadWorkflows();
    await onChange?.();
  };

  const moveSubstage = async (substageId, direction) => {
    if (!selectedPhase) return;

    const orderedSubstages = [...(selectedPhase.substages || [])].sort((left, right) => (Number(left?.substage_index) || 0) - (Number(right?.substage_index) || 0));
    const currentIndex = orderedSubstages.findIndex((substage) => substage.id === substageId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedSubstages.length) {
      return;
    }

    const reorderedSubstages = [...orderedSubstages];
    const [movedSubstage] = reorderedSubstages.splice(currentIndex, 1);
    reorderedSubstages.splice(nextIndex, 0, movedSubstage);

    setMovingSubstageId(substageId);

    const updates = reorderedSubstages.map((substage, index) => ({
      id: substage.id,
      substage_index: index + 1,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("workflow_substage_definitions").upsert(updates, { onConflict: "id" });

    setMovingSubstageId("");

    if (error) {
      toast.error(error.message || "Failed to reorder substages");
      return;
    }

    toast.success("Substage order updated");
    await loadWorkflows();
    await onChange?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Workflow Studio</h2>
          <p className="mt-1 text-sm text-slate-400">Build reusable five-phase templates, then add optional substages inside each phase.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-white/10 bg-slate-900/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {WORKFLOW_ENTITY_OPTIONS.map((option) => (
              <button key={option.value} type="button" className={`rounded-full px-4 py-2 text-xs font-medium transition-base ${entityType === option.value ? "bg-[linear-gradient(135deg,#22d3ee,#0f766e)] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/10"}`} onClick={() => setEntityType(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreateWorkflow} disabled={!orgId}>New Workflow</button>
        </div>
      </div>

      <div className="card overflow-hidden p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-100">{entityType === "project" ? "Project workflows" : "Hole workflows"}</div>
            <div className="mt-1 text-xs text-slate-400">Select a workflow to edit its five phase slots and optional substages.</div>
          </div>
          <div className="text-xs text-slate-400">{filteredWorkflows.length} total</div>
        </div>

        {loading ? <div className="mt-4 text-sm text-slate-400">Loading workflows...</div> : filteredWorkflows.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">No workflows yet for this record type.</div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredWorkflows.map((workflow) => {
              const selected = workflow.id === selectedWorkflowId;
              const namedPhases = workflow.phases.filter((phase) => String(phase.name || "").trim()).length;
              const substageCount = workflow.phases.reduce((sum, phase) => sum + (phase.substages?.length || 0), 0);

              return (
                <button key={workflow.id} type="button" className={`w-full rounded-[24px] border p-4 text-left transition-base ${selected ? "border-cyan-300/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(15,23,42,0.95))] shadow-[0_20px_50px_rgba(34,211,238,0.08)]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`} onClick={() => setSelectedWorkflowId(workflow.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <WorkflowBadge color={workflow.color}>{workflow.name}</WorkflowBadge>
                        {!workflow.is_active ? <span className="text-[11px] uppercase tracking-wide text-amber-300">inactive</span> : null}
                      </div>
                      <div className="mt-2 text-xs font-mono text-slate-400">{workflow.key}</div>
                      <div className="mt-1 text-sm text-slate-300/80">{workflow.description || "No description yet."}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>{namedPhases}/5 phases</div>
                      <div>{substageCount} substages</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!selectedWorkflow ? (
        <div className="card rounded-[28px] border-dashed p-6 text-sm text-slate-400">Select a workflow to manage its phases and substages.</div>
      ) : (
        <div className="space-y-5">
          <div
            className="relative overflow-hidden rounded-[30px] border border-white/10 p-5 md:p-6"
            style={{
              background: `linear-gradient(135deg, ${selectedWorkflow.color || DEFAULT_WORKFLOW_COLOR}20, rgba(15,23,42,0.94) 46%, rgba(2,6,23,0.98) 100%)`,
              boxShadow: `0 28px 100px ${(selectedWorkflow.color || DEFAULT_WORKFLOW_COLOR)}18`,
            }}
          >
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_58%)]" />
            <div className="relative space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <WorkflowBadge color={selectedWorkflow.color}>{selectedWorkflow.name}</WorkflowBadge>
                    <span className="text-xs font-mono text-slate-300/75">{selectedWorkflow.key}</span>
                    {!selectedWorkflow.is_active ? <span className="text-[11px] uppercase tracking-[0.18em] text-amber-300">inactive</span> : null}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200/80">{selectedWorkflow.description || "No description provided yet. Add one so the workflow has a clear purpose for the team."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-3d-glass" onClick={() => openEditWorkflow(selectedWorkflow)}>Edit Workflow</button>
                  <button type="button" className="btn btn-3d-glass" onClick={() => void toggleWorkflowActive(selectedWorkflow)}>{selectedWorkflow.is_active ? "Archive" : "Reactivate"}</button>
                  <button type="button" className="btn btn-danger" onClick={() => void deleteWorkflow(selectedWorkflow)}>Delete</button>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Workflow map</div>
                    <div className="mt-1 text-xs text-slate-300/75">Select a stage gate to open its combined stage and substage editor.</div>
                  </div>
                </div>
                <WorkflowStudioStageStrip
                  phases={selectedWorkflow.phases}
                  selectedPhaseId={selectedPhaseId}
                  onSelectPhase={(phaseId) => {
                    const phase = selectedWorkflow.phases.find((item) => item.id === phaseId);
                    if (phase) openEditPhase(phase);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card overflow-hidden rounded-[28px] p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-100">Flow builder</div>
                <div className="mt-1 text-xs text-slate-400">Five fixed phase slots. Name only the phases you need, then open a phase to manage up to five substages.</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-5">
              {selectedWorkflow.phases.map((phase) => (
                <PhaseSlotCard key={phase.id} phase={phase} selected={phase.id === selectedPhaseId} onOpen={openEditPhase} />
              ))}
            </div>
          </div>
        </div>
      )}

      {showWorkflowModal ? <WorkflowModal form={workflowForm} setForm={setWorkflowForm} saving={savingWorkflow} onClose={() => { setShowWorkflowModal(false); setEditingWorkflowId(null); }} onSave={saveWorkflow} editing={!!editingWorkflowId} /> : null}
      {showPhaseModal ? (
        <PhaseModal
          phase={selectedPhase}
          form={phaseForm}
          setForm={setPhaseForm}
          saving={savingPhase}
          onClose={closePhaseModal}
          onSave={savePhase}
          workflowName={selectedWorkflow?.name || ""}
          substageForm={substageForm}
          setSubstageForm={setSubstageForm}
          savingSubstage={savingSubstage}
          editingSubstageId={editingSubstageId}
          targetSubstageIndex={targetSubstageIndex}
          onCreateSubstage={openCreateSubstage}
          onEditSubstage={openEditSubstage}
          onSaveSubstage={saveSubstage}
          onDeleteSubstage={deleteSubstage}
          onMoveSubstage={moveSubstage}
          movingSubstageId={movingSubstageId}
        />
      ) : null}
    </div>
  );
}
