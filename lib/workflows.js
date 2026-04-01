export const WORKFLOW_ENTITY_OPTIONS = [
  { value: "project", label: "Projects" },
  { value: "hole", label: "Holes" },
];

export const DEFAULT_WORKFLOW_COLOR = "#38bdf8";
export const DEFAULT_STAGE_COLOR = "#0f766e";
export const WORKFLOW_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "#64748b" },
  { value: "planned", label: "Planned", color: "#38bdf8" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "complete", label: "Complete", color: "#10b981" },
];

export function slugifyWorkflowKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function sortWorkflowStages(stages) {
  return [...(stages || [])].sort((left, right) => {
    const sortDelta = (Number(left?.sort_order) || 0) - (Number(right?.sort_order) || 0);
    if (sortDelta !== 0) return sortDelta;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

export function sortWorkflowPhases(phases) {
  return [...(phases || [])].sort((left, right) => {
    const sortDelta = (Number(left?.phase_index) || 0) - (Number(right?.phase_index) || 0);
    if (sortDelta !== 0) return sortDelta;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

export function sortWorkflowSubstages(substages) {
  return [...(substages || [])].sort((left, right) => {
    const sortDelta = (Number(left?.substage_index) || 0) - (Number(right?.substage_index) || 0);
    if (sortDelta !== 0) return sortDelta;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

export function hasNamedWorkflowNode(value) {
  return String(value || "").trim().length > 0;
}

export function normalizeWorkflows(workflows, stageOrPhaseRows, substageRows) {
  const isHierarchical = Array.isArray(substageRows) || (stageOrPhaseRows || []).some((row) => Object.prototype.hasOwnProperty.call(row || {}, "phase_index"));

  if (isHierarchical) {
    const phaseMap = new Map();
    const substageMap = new Map();

    for (const substage of substageRows || []) {
      const phaseSubstages = substageMap.get(substage.workflow_phase_id) || [];
      phaseSubstages.push(substage);
      substageMap.set(substage.workflow_phase_id, phaseSubstages);
    }

    for (const phase of stageOrPhaseRows || []) {
      phaseMap.set(phase.workflow_id, [...(phaseMap.get(phase.workflow_id) || []), phase]);
    }

    return [...(workflows || [])]
      .map((workflow) => {
        const phases = sortWorkflowPhases(
          (phaseMap.get(workflow.id) || []).map((phase) => ({
            ...phase,
            substages: sortWorkflowSubstages(substageMap.get(phase.id) || []),
          }))
        );

        return {
          ...workflow,
          phases,
          namedPhases: phases.filter((phase) => hasNamedWorkflowNode(phase.name)),
          stages: [],
        };
      })
      .sort((left, right) => {
        if (left.entity_type !== right.entity_type) {
          return String(left.entity_type || "").localeCompare(String(right.entity_type || ""));
        }

        const sortDelta = (Number(left.sort_order) || 0) - (Number(right.sort_order) || 0);
        if (sortDelta !== 0) return sortDelta;
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
  }

  const stageMap = new Map();

  for (const stage of stageOrPhaseRows || []) {
    const workflowStages = stageMap.get(stage.workflow_id) || [];
    workflowStages.push(stage);
    stageMap.set(stage.workflow_id, workflowStages);
  }

  return [...(workflows || [])]
    .map((workflow) => ({
      ...workflow,
      stages: sortWorkflowStages(stageMap.get(workflow.id) || []),
      phases: [],
      namedPhases: [],
    }))
    .sort((left, right) => {
      if (left.entity_type !== right.entity_type) {
        return String(left.entity_type || "").localeCompare(String(right.entity_type || ""));
      }

      const sortDelta = (Number(left.sort_order) || 0) - (Number(right.sort_order) || 0);
      if (sortDelta !== 0) return sortDelta;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}

export function getWorkflowPhaseOptions(workflow) {
  return sortWorkflowPhases(workflow?.namedPhases || workflow?.phases || []).filter((phase) => hasNamedWorkflowNode(phase.name));
}

export function getWorkflowSubstageOptions(workflow, phaseId = "") {
  const phase = getWorkflowPhaseOptions(workflow).find((item) => item.id === phaseId) || null;
  return sortWorkflowSubstages(phase?.substages || []).filter((substage) => hasNamedWorkflowNode(substage.name));
}

export function getFirstWorkflowPhaseId(workflow) {
  return getWorkflowPhaseOptions(workflow)[0]?.id || "";
}

export function getFirstWorkflowSubstageId(workflow, phaseId = "") {
  return getWorkflowSubstageOptions(workflow, phaseId)[0]?.id || "";
}

export function resolveHierarchicalWorkflowSelection(workflows, workflowId, phaseId = "", substageId = "") {
  const workflow = (workflows || []).find((item) => item.id === workflowId) || null;
  if (!workflow) {
    return { workflowId: "", phaseId: "", substageId: "" };
  }

  const phases = getWorkflowPhaseOptions(workflow);
  const selectedPhase = phases.find((phase) => phase.id === phaseId) || phases[0] || null;
  if (!selectedPhase) {
    return { workflowId: workflow.id, phaseId: "", substageId: "" };
  }

  const substages = getWorkflowSubstageOptions(workflow, selectedPhase.id);
  const selectedSubstage = substages.find((substage) => substage.id === substageId) || null;

  return {
    workflowId: workflow.id,
    phaseId: selectedPhase.id,
    substageId: selectedSubstage?.id || "",
  };
}

export function getWorkflowStageOptions(workflow) {
  return sortWorkflowStages(workflow?.stages || []).filter((stage) => stage.is_active !== false);
}

export function getFirstWorkflowStageId(workflow) {
  return getWorkflowStageOptions(workflow)[0]?.id || "";
}

export function resolveWorkflowSelection(workflows, workflowId, stageId = "") {
  const workflow = (workflows || []).find((item) => item.id === workflowId) || null;
  if (!workflow) {
    return { workflowId: "", stageId: "" };
  }

  const stages = getWorkflowStageOptions(workflow);
  const selectedStage = stages.find((stage) => stage.id === stageId) || null;

  return {
    workflowId: workflow.id,
    stageId: selectedStage?.id || stages[0]?.id || "",
  };
}

export function formatWorkflowStageLabel(stage) {
  if (!stage) return "No stage";
  return stage.is_terminal ? `${stage.name} · terminal` : stage.name;
}

export function formatWorkflowPhaseLabel(phase) {
  if (!phase?.name) return "Unnamed phase";
  return `Phase ${phase.phase_index}: ${phase.name}`;
}

export function formatWorkflowSubstageLabel(substage) {
  if (!substage?.name) return "Unnamed substage";
  return substage.name;
}

export function getWorkflowStatusMeta(statusKey) {
  return WORKFLOW_STATUS_OPTIONS.find((option) => option.value === statusKey) || WORKFLOW_STATUS_OPTIONS[0];
}

export function getWorkflowAssignmentLabel(record) {
  if (record?.current_workflow_substage?.name) return record.current_workflow_substage.name;
  if (record?.current_workflow_phase?.name) return record.current_workflow_phase.name;
  if (record?.current_workflow_stage?.name) return record.current_workflow_stage.name;
  return "No workflow";
}

export function getWorkflowAssignmentColor(record) {
  return record?.current_workflow_substage?.color || record?.current_workflow_phase?.color || record?.current_workflow_stage?.color || DEFAULT_STAGE_COLOR;
}

export function getWorkflowBadgeStyle(color) {
  const tone = color || DEFAULT_STAGE_COLOR;
  return {
    borderColor: `${tone}55`,
    backgroundColor: `${tone}1f`,
    color: tone,
  };
}