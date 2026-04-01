"use client";

import { AUSTRALIAN_PROJECT_CRS, getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import {
  WORKFLOW_STATUS_OPTIONS,
  formatWorkflowPhaseLabel,
  formatWorkflowSubstageLabel,
  getWorkflowPhaseOptions,
  getWorkflowSubstageOptions,
  resolveHierarchicalWorkflowSelection,
} from "@/lib/workflows";

export default function ProjectModal({ editingId, form, setForm, saving, onClose, onSave, onNew, workflows = [] }) {
  const selectedCrs = getAustralianProjectCrsByCode(form.coordinate_crs_code);
  const selectedWorkflow = workflows.find((workflow) => workflow.id === form.current_workflow_id) || null;
  const phaseOptions = getWorkflowPhaseOptions(selectedWorkflow);
  const substageOptions = getWorkflowSubstageOptions(selectedWorkflow, form.current_workflow_phase_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingId ? "Edit Project" : "New Project"}</h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Project Name"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              Start
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              Finish
              <input
                type="date"
                value={form.finish_date}
                onChange={(e) => setForm((f) => ({ ...f, finish_date: e.target.value }))}
                className="input"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            Cost Code
            <input
              type="text"
              value={form.cost_code}
              onChange={(e) => setForm((f) => ({ ...f, cost_code: e.target.value }))}
              className="input"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            WBS Code
            <input
              type="text"
              value={form.wbs_code}
              onChange={(e) => setForm((f) => ({ ...f, wbs_code: e.target.value }))}
              className="input"
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-sm font-medium text-slate-100">Workflow</div>
            <div className="mt-1 text-xs text-slate-300/70">
              Track the current workflow phase, optional substage, and current status for this project.
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                Workflow
                <select
                  value={form.current_workflow_id || ""}
                  onChange={(e) => {
                    const nextSelection = resolveHierarchicalWorkflowSelection(workflows, e.target.value);

                    setForm((prev) => ({
                      ...prev,
                      current_workflow_id: nextSelection.workflowId,
                      current_workflow_phase_id: nextSelection.phaseId,
                      current_workflow_substage_id: nextSelection.substageId,
                      current_workflow_status_key: nextSelection.workflowId ? prev.current_workflow_status_key || "not_started" : "not_started",
                    }));
                  }}
                  className="input"
                >
                  <option value="">No workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id} disabled={workflow.is_active === false}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                Phase
                <select
                  value={form.current_workflow_phase_id || ""}
                  onChange={(e) => {
                    const nextPhaseId = e.target.value;
                    const nextSubstageId = getWorkflowSubstageOptions(selectedWorkflow, nextPhaseId)[0]?.id || "";
                    setForm((prev) => ({
                      ...prev,
                      current_workflow_phase_id: nextPhaseId,
                      current_workflow_substage_id: nextSubstageId,
                    }));
                  }}
                  className="input"
                  disabled={!selectedWorkflow}
                >
                  <option value="">{selectedWorkflow ? "Select a phase" : "Choose a workflow first"}</option>
                  {phaseOptions.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {formatWorkflowPhaseLabel(phase)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                Substage
                <select
                  value={form.current_workflow_substage_id || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, current_workflow_substage_id: e.target.value }))}
                  className="input"
                  disabled={!selectedWorkflow || !form.current_workflow_phase_id}
                >
                  <option value="">{form.current_workflow_phase_id ? "No substage" : "Choose a phase first"}</option>
                  {substageOptions.map((substage) => (
                    <option key={substage.id} value={substage.id}>
                      {formatWorkflowSubstageLabel(substage)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                Status
                <select
                  value={form.current_workflow_status_key || "not_started"}
                  onChange={(e) => setForm((prev) => ({ ...prev, current_workflow_status_key: e.target.value }))}
                  className="input"
                  disabled={!selectedWorkflow || !form.current_workflow_phase_id}
                >
                  {WORKFLOW_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-sm font-medium text-slate-100">Coordinate system</div>
            <div className="mt-1 text-xs text-slate-300/70">
              Set the working project CRS used for projected coordinates such as easting and northing.
            </div>

            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1.5 text-sm">
                Australian CRS
                <select
                  value={form.coordinate_crs_code || ""}
                  onChange={(e) => {
                    const crs = getAustralianProjectCrsByCode(e.target.value);
                    setForm((f) => ({
                      ...f,
                      coordinate_crs_code: crs?.code || "",
                      coordinate_crs_name: crs?.name || "",
                    }));
                  }}
                  className="input"
                >
                  <option value="">Select coordinate system</option>
                  {AUSTRALIAN_PROJECT_CRS.map((crs) => (
                    <option key={crs.code} value={crs.code}>
                      {crs.name} ({crs.code})
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                {selectedCrs
                  ? `Selected: ${selectedCrs.name} (${selectedCrs.code})`
                  : "Projected coordinates will stay unconfigured until you choose a project CRS."}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="btn btn-primary flex-1">
            {saving ? "Saving…" : editingId ? "Save Changes" : "Create Project"}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={onNew}>
              New
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-300/70">Only members of this organization can see these projects.</div>
      </div>
    </div>
  );
}