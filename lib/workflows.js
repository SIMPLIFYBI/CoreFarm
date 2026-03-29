export const WORKFLOW_ENTITY_OPTIONS = [
  { value: "project", label: "Projects" },
  { value: "hole", label: "Holes" },
];

export const DEFAULT_WORKFLOW_COLOR = "#38bdf8";
export const DEFAULT_STAGE_COLOR = "#0f766e";

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

export function normalizeWorkflows(workflows, stages) {
  const stageMap = new Map();

  for (const stage of stages || []) {
    const workflowStages = stageMap.get(stage.workflow_id) || [];
    workflowStages.push(stage);
    stageMap.set(stage.workflow_id, workflowStages);
  }

  return [...(workflows || [])]
    .map((workflow) => ({
      ...workflow,
      stages: sortWorkflowStages(stageMap.get(workflow.id) || []),
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

export function getWorkflowBadgeStyle(color) {
  const tone = color || DEFAULT_STAGE_COLOR;
  return {
    borderColor: `${tone}55`,
    backgroundColor: `${tone}1f`,
    color: tone,
  };
}