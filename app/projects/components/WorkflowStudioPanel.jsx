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

function PhaseModal({ form, setForm, saving, onClose, onSave, workflowName, phaseIndex }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Edit phase</h3>
            <p className="mt-1 text-sm text-slate-400">{workflowName ? `${workflowName} · Phase ${phaseIndex}` : `Phase ${phaseIndex}`}</p>
          </div>
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm text-slate-200">
            Phase name
            <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Planned" />
          </label>

          <label className="text-sm text-slate-200">
            Description
            <textarea className="textarea mt-1 w-full" rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What this phase means operationally." />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save phase"}</button>
        </div>
      </div>
    </div>
  );
}

function SubstageModal({ form, setForm, saving, onClose, onSave, workflowName, phaseName, editing }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{editing ? "Edit substage" : "Add substage"}</h3>
            <p className="mt-1 text-sm text-slate-400">{workflowName && phaseName ? `${workflowName} · ${phaseName}` : "Operational detail inside the selected phase."}</p>
          </div>
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm text-slate-200">
            Substage name
            <input className="input mt-1 w-full" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Awaiting approvals" />
          </label>

          <label className="text-sm text-slate-200">
            Description
            <textarea className="textarea mt-1 w-full" rows={4} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What the team should understand about this substage." />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-3d-glass" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : editing ? "Save substage" : "Create substage"}</button>
        </div>
      </div>
    </div>
  );
}

function WorkflowBadge({ color, children }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium" style={getWorkflowBadgeStyle(color)}>{children}</span>;
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

function PhaseSlotCard({ phase, selected, onSelect, onEdit }) {
  const named = String(phase?.name || "").trim().length > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(phase.id)}
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
        <span className="btn btn-3d-glass px-3 py-1.5 text-xs" onClick={(event) => { event.stopPropagation(); onEdit(phase); }}>
          {named ? "Edit phase" : "Name phase"}
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
  const [showSubstageModal, setShowSubstageModal] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState(null);
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [editingSubstageId, setEditingSubstageId] = useState(null);
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

  const workflowMetrics = useMemo(() => {
    if (!selectedWorkflow) {
      return { namedPhases: 0, totalPhases: 5, totalSubstages: 0 };
    }

    return {
      namedPhases: selectedWorkflow.phases.filter((phase) => String(phase.name || "").trim()).length,
      totalPhases: selectedWorkflow.phases.length,
      totalSubstages: selectedWorkflow.phases.reduce((sum, phase) => sum + (phase.substages?.length || 0), 0),
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
    setShowPhaseModal(true);
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
    }

    setSavingPhase(false);
    toast.success("Phase saved");
    setShowPhaseModal(false);
    setEditingPhaseId(null);
    await loadWorkflows();
    await onChange?.();
  };

  const openCreateSubstage = () => {
    if (!selectedPhase) return;
    if (!String(selectedPhase.name || "").trim()) {
      toast.error("Name the phase before adding substages");
      return;
    }
    if ((selectedPhase.substages?.length || 0) >= 5) {
      toast.error("Each phase can only have 5 substages");
      return;
    }
    setEditingSubstageId(null);
    setSubstageForm(EMPTY_SUBSTAGE_FORM);
    setShowSubstageModal(true);
  };

  const openEditSubstage = (substage) => {
    setEditingSubstageId(substage.id);
    setSubstageForm({
      name: substage.name || "",
      description: substage.description || "",
    });
    setShowSubstageModal(true);
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
      const nextIndex = [1, 2, 3, 4, 5].find((index) => !usedIndexes.has(index)) || null;
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
    setShowSubstageModal(false);
    setEditingSubstageId(null);
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

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Named phases</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.namedPhases}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Phase slots</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.totalPhases}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Configured substages</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{workflowMetrics.totalSubstages}</div>
                </div>
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
                <PhaseSlotCard key={phase.id} phase={phase} selected={phase.id === selectedPhaseId} onSelect={setSelectedPhaseId} onEdit={openEditPhase} />
              ))}
            </div>
          </div>

          {selectedPhase ? (
            <div className="card rounded-[28px] p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Selected phase</div>
                  <h3 className="mt-2 text-xl font-semibold text-white">{String(selectedPhase.name || "").trim() ? formatWorkflowPhaseLabel(selectedPhase) : `Phase ${selectedPhase.phase_index} is currently unused`}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300/85">{selectedPhase.description || "Name this phase if your organisation needs it. Unnamed phases stay hidden outside the workflow studio."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-3d-glass" onClick={() => openEditPhase(selectedPhase)}>{String(selectedPhase.name || "").trim() ? "Edit phase" : "Name phase"}</button>
                  <button type="button" className="btn btn-primary" onClick={openCreateSubstage} disabled={!String(selectedPhase.name || "").trim() || (selectedPhase.substages?.length || 0) >= 5}>Add substage</button>
                </div>
              </div>

              <div className="mt-5">
                <SubstageList substages={selectedPhase.substages || []} onMove={(substageId, direction) => void moveSubstage(substageId, direction)} movingSubstageId={movingSubstageId} onEdit={openEditSubstage} onDelete={(substage) => void deleteSubstage(substage)} />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {showWorkflowModal ? <WorkflowModal form={workflowForm} setForm={setWorkflowForm} saving={savingWorkflow} onClose={() => { setShowWorkflowModal(false); setEditingWorkflowId(null); }} onSave={saveWorkflow} editing={!!editingWorkflowId} /> : null}
      {showPhaseModal ? <PhaseModal form={phaseForm} setForm={setPhaseForm} saving={savingPhase} onClose={() => { setShowPhaseModal(false); setEditingPhaseId(null); }} onSave={savePhase} workflowName={selectedWorkflow?.name || ""} phaseIndex={selectedPhase?.phase_index || 0} /> : null}
      {showSubstageModal ? <SubstageModal form={substageForm} setForm={setSubstageForm} saving={savingSubstage} onClose={() => { setShowSubstageModal(false); setEditingSubstageId(null); }} onSave={saveSubstage} workflowName={selectedWorkflow?.name || ""} phaseName={selectedPhase?.name || `Phase ${selectedPhase?.phase_index || ""}`} editing={!!editingSubstageId} /> : null}
    </div>
  );
}
