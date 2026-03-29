"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  DEFAULT_STAGE_COLOR,
  DEFAULT_WORKFLOW_COLOR,
  WORKFLOW_ENTITY_OPTIONS,
  formatWorkflowStageLabel,
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

const EMPTY_STAGE_FORM = {
  name: "",
  key: "",
  description: "",
  color: DEFAULT_STAGE_COLOR,
  sort_order: "",
  is_terminal: false,
  is_active: true,
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
            <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Assay delivery" />
          </label>

          <label className="text-sm text-slate-200">
            Machine key
            <input className="input mt-1 w-full font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="assay_delivery" />
          </label>

          <label className="text-sm text-slate-200">
            Sort order
            <input className="input mt-1 w-full" type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} placeholder="10" />
          </label>

          <label className="text-sm text-slate-200 md:col-span-2">
            Description
            <textarea className="textarea mt-1 w-full" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Track the delivery steps used by your team." />
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

function StageModal({ form, setForm, saving, onClose, onSave, editing, workflowName }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{editing ? "Edit stage" : "Add stage"}</h3>
            <p className="mt-1 text-sm text-slate-400">{workflowName ? `Stage inside ${workflowName}` : "Define the current workflow step."}</p>
          </div>
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            Stage name
            <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Awaiting assays" />
          </label>

          <label className="text-sm text-slate-200">
            Machine key
            <input className="input mt-1 w-full font-mono" value={form.key} onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))} placeholder="awaiting_assays" />
          </label>

          <label className="text-sm text-slate-200">
            Sort order
            <input className="input mt-1 w-full" type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} placeholder="10" />
          </label>

          <label className="text-sm text-slate-200">
            Color
            <div className="mt-1 flex items-center gap-3">
              <input className="h-10 w-14 rounded border border-white/10 bg-transparent p-1" type="color" value={form.color || DEFAULT_STAGE_COLOR} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
              <input className="input w-full" value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} placeholder="#0f766e" />
            </div>
          </label>

          <label className="text-sm text-slate-200 md:col-span-2">
            Description
            <textarea className="textarea mt-1 w-full" rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What this stage means to your team." />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
            Active and assignable
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={form.is_terminal} onChange={(e) => setForm((prev) => ({ ...prev, is_terminal: e.target.checked }))} />
            Terminal stage
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : editing ? "Save stage" : "Create stage"}</button>
        </div>
      </div>
    </div>
  );
}

function WorkflowBadge({ color, children }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium" style={getWorkflowBadgeStyle(color)}>{children}</span>;
}

function getStageVisualState(stage) {
  if (stage.is_active === false) {
    return {
      label: "Inactive",
      tone: "#f59e0b",
      subtitle: "Hidden from assignment",
    };
  }

  if (stage.is_terminal) {
    return {
      label: "Terminal",
      tone: "#ef4444",
      subtitle: "Final step in flow",
    };
  }

  return {
    label: "Active",
    tone: stage.color || DEFAULT_STAGE_COLOR,
    subtitle: "Assignable in records",
  };
}

function StageVisualMap({ stages, selectedStageId, onSelect, onEdit, onToggle, onDelete, onAddStage }) {
  return (
    <div className="mt-5 overflow-x-auto pb-3">
      <div className="relative min-w-max overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,23,42,0.96))]">
        <div className="pointer-events-none absolute left-0 right-0 top-[8.8rem] h-[3px] bg-white/20" />
        <div className="pointer-events-none absolute left-0 right-0 top-[8.8rem] h-[3px] bg-[linear-gradient(90deg,rgba(34,211,238,0.28),rgba(250,204,21,0.18),rgba(239,68,68,0.22))]" />

        <div className="grid auto-cols-[minmax(180px,1fr)] grid-flow-col">
          {stages.map((stage, index) => {
            const isSelected = stage.id === selectedStageId;
            const visualState = getStageVisualState(stage);

            return (
              <div
                key={stage.id}
                className="relative min-h-[22rem] border-r border-white/8 last:border-r-0"
                style={{
                  background: `linear-gradient(180deg, ${visualState.tone}22 0%, rgba(255,255,255,0.03) 46%, rgba(2,6,23,0.72) 100%)`,
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-[repeating-linear-gradient(100deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_12px,transparent_12px,transparent_24px)] opacity-80" />
                <div className="pointer-events-none absolute inset-x-0 top-[8rem] h-8 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.06),transparent)]" />

                <div className="relative flex h-full flex-col p-3.5 md:p-4">
                  <button type="button" className="text-left" onClick={() => onSelect(stage.id)}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300/75">Stage {index + 1}</div>
                    <div className="mt-2 text-sm font-semibold uppercase leading-tight text-white md:text-base">{stage.name}</div>
                    <div className="mt-2 inline-flex rounded-full border border-black/20 bg-black/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-100 shadow-[0_8px_18px_rgba(2,6,23,0.24)]">
                      {visualState.subtitle}
                    </div>
                  </button>

                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      aria-label={`Open details for ${stage.name}`}
                      className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white/85 bg-slate-950 transition duration-200 md:h-16 md:w-16"
                      style={{
                        boxShadow: isSelected
                          ? `0 0 0 7px ${visualState.tone}26, 0 18px 38px ${visualState.tone}33`
                          : `0 0 0 5px ${visualState.tone}18, 0 10px 20px rgba(2,6,23,0.24)`,
                      }}
                      onClick={() => onSelect(stage.id)}
                    >
                      <span
                        className="inline-flex h-7 w-7 rounded-full border border-white/20 md:h-8 md:w-8"
                        style={{
                          background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.24), ${visualState.tone})`,
                        }}
                      />
                      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/15 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/90">
                        {visualState.label}
                      </span>
                    </button>
                  </div>

                  <div className="mt-14 flex-1">
                    {isSelected ? (
                      <div className="rounded-[20px] border border-white/12 bg-black/35 p-3 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <WorkflowBadge color={stage.color}>{formatWorkflowStageLabel(stage)}</WorkflowBadge>
                          <span className="font-mono text-[11px] text-slate-400">{stage.key}</span>
                        </div>
                        <p className="mt-2.5 text-xs leading-5 text-slate-200/85 md:text-sm md:leading-6">
                          {stage.description || "Add more detail here so the selected stage explains its operational meaning clearly."}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300/80 md:text-xs">
                          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
                            <div className="text-slate-400">Sort</div>
                            <div className="mt-1 font-semibold text-white">{stage.sort_order ?? 0}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-2.5 py-2">
                            <div className="text-slate-400">Status</div>
                            <div className="mt-1 font-semibold text-white">{visualState.label}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={() => onEdit(stage)}>Edit</button>
                          <button type="button" className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={() => onToggle(stage)}>{stage.is_active ? "Archive" : "Reactivate"}</button>
                          <button type="button" className="btn btn-danger px-3 py-1.5 text-xs" onClick={() => onDelete(stage)}>Delete</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded-[18px] border border-dashed border-white/10 bg-black/15 px-3 py-2.5 text-left text-xs text-slate-300/70 transition-base hover:border-white/20 hover:bg-black/25 hover:text-slate-100 md:text-sm"
                        onClick={() => onSelect(stage.id)}
                      >
                        Click to expand stage details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="relative min-h-[22rem] w-[180px] border-r-0 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(2,6,23,0.9))]">
            <div className="relative flex h-full flex-col justify-between p-3.5 md:p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300/75">Expand flow</div>
                <div className="mt-2 text-sm font-semibold uppercase leading-tight text-white md:text-base">Add another stage</div>
                <p className="mt-3 text-xs leading-5 text-slate-300/80 md:text-sm md:leading-6">Keep extending the workflow with another visual node in the sequence.</p>
              </div>

              <div className="flex justify-center pb-[5.75rem]">
                <button
                  type="button"
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-dashed border-cyan-200/60 bg-cyan-300/10 text-2xl text-cyan-100 shadow-[0_0_0_7px_rgba(34,211,238,0.08)] transition-base hover:bg-cyan-300/18 md:h-16 md:w-16"
                  onClick={onAddStage}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowStudioPanel({ orgId, onChange }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [entityType, setEntityType] = useState("project");
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState(null);
  const [editingStageId, setEditingStageId] = useState(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [workflowForm, setWorkflowForm] = useState(EMPTY_WORKFLOW_FORM);
  const [stageForm, setStageForm] = useState(EMPTY_STAGE_FORM);

  const loadWorkflows = async () => {
    if (!orgId) {
      setWorkflows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [workflowRes, stageRes] = await Promise.all([
      supabase.from("workflow_definitions").select("id, organization_id, entity_type, key, name, description, color, sort_order, is_active, created_at").eq("organization_id", orgId),
      supabase.from("workflow_stages").select("id, workflow_id, key, name, description, color, sort_order, is_terminal, is_active, created_at"),
    ]);

    if (workflowRes.error) {
      toast.error(workflowRes.error.message || "Failed to load workflows");
      setWorkflows([]);
      setLoading(false);
      return;
    }

    if (stageRes.error) {
      toast.error(stageRes.error.message || "Failed to load workflow stages");
      setWorkflows([]);
      setLoading(false);
      return;
    }

    setWorkflows(normalizeWorkflows(workflowRes.data || [], stageRes.data || []));
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
    if (!selectedWorkflow?.stages?.length) {
      setSelectedStageId("");
      return;
    }

    if (!selectedWorkflow.stages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(selectedWorkflow.stages[0].id);
    }
  }, [selectedStageId, selectedWorkflow]);

  const selectedStage = useMemo(
    () => selectedWorkflow?.stages.find((stage) => stage.id === selectedStageId) || null,
    [selectedStageId, selectedWorkflow]
  );

  const workflowMetrics = useMemo(() => {
    if (!selectedWorkflow) {
      return { totalStages: 0, activeStages: 0, terminalStages: 0 };
    }

    return {
      totalStages: selectedWorkflow.stages.length,
      activeStages: selectedWorkflow.stages.filter((stage) => stage.is_active !== false).length,
      terminalStages: selectedWorkflow.stages.filter((stage) => stage.is_terminal).length,
    };
  }, [selectedWorkflow]);

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
    if (!window.confirm(`Delete workflow "${workflow.name}"? This will also remove its stages.`)) return;
    const { error } = await supabase.from("workflow_definitions").delete().eq("id", workflow.id);
    if (error) return toast.error(error.message || "Failed to delete workflow");
    toast.success("Workflow deleted");
    await loadWorkflows();
    await onChange?.();
  };

  const openCreateStage = () => {
    if (!selectedWorkflow) return;
    setEditingStageId(null);
    setStageForm(EMPTY_STAGE_FORM);
    setShowStageModal(true);
  };

  const openEditStage = (stage) => {
    setEditingStageId(stage.id);
    setSelectedStageId(stage.id);
    setStageForm({
      name: stage.name || "",
      key: stage.key || "",
      description: stage.description || "",
      color: stage.color || DEFAULT_STAGE_COLOR,
      sort_order: String(stage.sort_order ?? ""),
      is_terminal: !!stage.is_terminal,
      is_active: stage.is_active !== false,
    });
    setShowStageModal(true);
  };

  const saveStage = async () => {
    if (!selectedWorkflow) return toast.error("Select a workflow first");
    const key = slugifyWorkflowKey(stageForm.key || stageForm.name);
    if (!key) return toast.error("Stage key is required");

    setSavingStage(true);
    const payload = {
      workflow_id: selectedWorkflow.id,
      name: stageForm.name.trim(),
      key,
      description: stageForm.description.trim() || null,
      color: stageForm.color || null,
      sort_order: stageForm.sort_order === "" ? 0 : Number(stageForm.sort_order),
      is_terminal: !!stageForm.is_terminal,
      is_active: !!stageForm.is_active,
    };

    const { error } = editingStageId
      ? await supabase.from("workflow_stages").update(payload).eq("id", editingStageId)
      : await supabase.from("workflow_stages").insert(payload);

    setSavingStage(false);

    if (error) {
      toast.error(error.message || "Failed to save stage");
      return;
    }

    toast.success(editingStageId ? "Stage updated" : "Stage created");
    setShowStageModal(false);
    setEditingStageId(null);
    await loadWorkflows();
    await onChange?.();
  };

  const toggleStageActive = async (stage) => {
    const { error } = await supabase.from("workflow_stages").update({ is_active: !stage.is_active }).eq("id", stage.id);
    if (error) return toast.error(error.message || "Failed to update stage");
    toast.success(stage.is_active ? "Stage archived" : "Stage reactivated");
    await loadWorkflows();
    await onChange?.();
  };

  const deleteStage = async (stage) => {
    if (!window.confirm(`Delete stage "${stage.name}"?`)) return;
    const { error } = await supabase.from("workflow_stages").delete().eq("id", stage.id);
    if (error) return toast.error(error.message || "Failed to delete stage");
    toast.success("Stage deleted");
    await loadWorkflows();
    await onChange?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Workflow Studio</h2>
          <p className="mt-1 text-sm text-slate-400">Build reusable stage-gate templates visually, then assign their current stage in project and hole records.</p>
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

      <div className="space-y-5">
        <div className="card overflow-hidden p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-100">{entityType === "project" ? "Project workflows" : "Hole workflows"}</div>
              <div className="mt-1 text-xs text-slate-400">Select a workflow, then use the full-width flow builder below.</div>
            </div>
            <div className="text-xs text-slate-400">{filteredWorkflows.length} total</div>
          </div>

          {loading ? <div className="mt-4 text-sm text-slate-400">Loading workflows...</div> : filteredWorkflows.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">No workflows yet for this record type.</div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredWorkflows.map((workflow) => {
                const selected = workflow.id === selectedWorkflowId;
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
                        <div className="mt-3 flex items-center gap-1.5">
                          {workflow.stages.slice(0, 4).map((stage) => (
                            <span key={stage.id} className="h-2.5 w-8 rounded-full border border-white/10" style={{ backgroundColor: stage.color || DEFAULT_STAGE_COLOR }} />
                          ))}
                          {workflow.stages.length > 4 ? <span className="text-[11px] text-slate-400">+{workflow.stages.length - 4}</span> : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div>{workflow.stages.length} stage{workflow.stages.length === 1 ? "" : "s"}</div>
                        <div>Sort {workflow.sort_order ?? 0}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!selectedWorkflow ? (
          <div className="card rounded-[28px] border-dashed p-6 text-sm text-slate-400">Select a workflow to manage its stages.</div>
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

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Total stages</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.totalStages}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Assignable</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.activeStages}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Terminal stages</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.terminalStages}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card overflow-hidden rounded-[28px] p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">Flow builder</div>
                  <div className="mt-1 text-xs text-slate-400">The visualization now spans the full content width so the stage map can breathe.</div>
                </div>
                <button type="button" className="btn btn-primary" onClick={openCreateStage}>Add Stage</button>
              </div>

              {selectedWorkflow.stages.length === 0 ? (
                <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">This workflow has no stages yet.</div>
              ) : (
                <StageVisualMap
                  stages={selectedWorkflow.stages}
                  selectedStageId={selectedStageId}
                  onSelect={setSelectedStageId}
                  onEdit={openEditStage}
                  onToggle={(stage) => void toggleStageActive(stage)}
                  onDelete={(stage) => void deleteStage(stage)}
                  onAddStage={openCreateStage}
                />
              )}
            </div>

            {selectedStage ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="card rounded-[28px] p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <WorkflowBadge color={selectedStage.color}>{formatWorkflowStageLabel(selectedStage)}</WorkflowBadge>
                    <span className="font-mono text-xs text-slate-400">{selectedStage.key}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">{selectedStage.name}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300/85">
                    {selectedStage.description || "Add a description for this stage so the workflow is easier to operate and understand across the team."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-3d-glass" onClick={() => openEditStage(selectedStage)}>Edit stage</button>
                    <button type="button" className="btn btn-3d-glass" onClick={() => void toggleStageActive(selectedStage)}>{selectedStage.is_active ? "Archive stage" : "Reactivate stage"}</button>
                    <button type="button" className="btn btn-danger" onClick={() => void deleteStage(selectedStage)}>Delete stage</button>
                  </div>
                </div>

                <div className="card rounded-[28px] p-5 md:p-6">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Stage details</div>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                      <dt className="text-slate-400">Sort order</dt>
                      <dd className="mt-1 text-lg font-semibold text-white">{selectedStage.sort_order ?? 0}</dd>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                      <dt className="text-slate-400">Assignable</dt>
                      <dd className="mt-1 text-lg font-semibold text-white">{selectedStage.is_active ? "Yes" : "No"}</dd>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                      <dt className="text-slate-400">Terminal</dt>
                      <dd className="mt-1 text-lg font-semibold text-white">{selectedStage.is_terminal ? "Final stage" : "Intermediate"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showWorkflowModal ? <WorkflowModal form={workflowForm} setForm={setWorkflowForm} saving={savingWorkflow} onClose={() => { setShowWorkflowModal(false); setEditingWorkflowId(null); }} onSave={saveWorkflow} editing={!!editingWorkflowId} /> : null}
      {showStageModal ? <StageModal form={stageForm} setForm={setStageForm} saving={savingStage} onClose={() => { setShowStageModal(false); setEditingStageId(null); }} onSave={saveStage} editing={!!editingStageId} workflowName={selectedWorkflow?.name || ""} /> : null}
    </div>
  );
}