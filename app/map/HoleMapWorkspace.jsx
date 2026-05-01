"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { attachHoleDescriptors, fetchHoleDescriptorAssignments, replaceHoleDescriptorAssignments } from "@/lib/holeDescriptors";
import { normalizeWorkflows } from "@/lib/workflows";
import DepthAxisBar from "@/app/drillhole-viz/components/DepthAxisBar";
import BoreholeSchematicPreview from "@/app/drillhole-viz/components/BoreholeSchematicPreview";
import { convertProjectedToWgs84 } from "@/lib/coordinateTransforms";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";
import MapCreateEntityPanel from "./MapCreateEntityPanel";

const MAP_SCOPE_STORAGE_KEY = "map:projectScope";
const MAP_RETURN_STATE_STORAGE_KEY = "map:returnState";
const HOLES_SOURCE_ID = "prod-hole-map-source";
const HOLES_GLOW_LAYER_ID = "prod-hole-map-glow";
const HOLES_CIRCLE_LAYER_ID = "prod-hole-map-circles";
const HOLES_SELECTED_LAYER_ID = "prod-hole-map-selected";
const HOLES_LABEL_LAYER_ID = "prod-hole-map-labels";
const ASSETS_SOURCE_ID = "prod-asset-map-source";
const ASSETS_GLOW_LAYER_ID = "prod-asset-map-glow";
const ASSETS_CIRCLE_LAYER_ID = "prod-asset-map-circles";
const ASSETS_SELECTED_LAYER_ID = "prod-asset-map-selected";
const CREATE_POINT_SOURCE_ID = "prod-map-create-point-source";
const CREATE_POINT_FILL_LAYER_ID = "prod-map-create-point-fill";
const CREATE_POINT_RING_LAYER_ID = "prod-map-create-point-ring";
const LOCATION_PROPOSALS_SOURCE_ID = "prod-map-location-proposals-source";
const LOCATION_PROPOSALS_LINE_LAYER_ID = "prod-map-location-proposals-line";
const LOCATION_PROPOSALS_ARROW_LAYER_ID = "prod-map-location-proposals-arrow";
const LOCATION_PROPOSALS_POINT_LAYER_ID = "prod-map-location-proposals-point";
const LOCATION_PROPOSALS_POINT_RING_LAYER_ID = "prod-map-location-proposals-point-ring";
const DEFAULT_CENTER = [134.2, -25.7];
const DEFAULT_ZOOM = 2.85;
const DEFAULT_PITCH = 0;
const DEFAULT_BEARING = 0;
const MAPBOX_STYLE_URL = "mapbox://styles/jamesblue/cmmhkajfi000w01shgzr5c1op";
const MAPBOX_FALLBACK_STYLE_URL = "mapbox://styles/mapbox/satellite-streets-v12";
const MAP_REFOCUS_SPEED = 0.52;
const MAP_REFOCUS_CURVE = 1.5;
const MAP_SELECTION_ZOOM = 15.8;
const MAP_ASSET_SELECTION_ZOOM = 16.3;
const MAP_PROJECT_FRAME_DURATION = 2800;
const HOLE_STATE_STYLES = [
  { value: "proposed", label: "Proposed", color: "#38bdf8" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "drilled", label: "Drilled", color: "#22c55e" },
];

const ASSET_COLOR = "#f472b6";
const ASSET_STATUS_STYLES = [{ value: "assets", label: "Assets", color: ASSET_COLOR }];
const VALID_HOLE_COLLAR_SOURCES = new Set(["gps", "survey", "estimated", "imported"]);
const DEFAULT_HOLE_COLLAR_SOURCE = "estimated";
const MAP_WORKFLOW_LIGHT_META = {
  complete: {
    label: "Signed off",
    ringClassName: "border-emerald-300/45 text-emerald-300 shadow-[0_0_24px_rgba(74,222,128,0.18)]",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-emerald-200/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.95),rgba(5,150,105,0.82))] text-white",
    chipClassName: "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
  },
  in_progress: {
    label: "In progress",
    ringClassName: "border-amber-300/45 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.18)]",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-amber-200/20 bg-[linear-gradient(145deg,rgba(251,191,36,0.95),rgba(217,119,6,0.82))] text-slate-950",
    chipClassName: "border-amber-300/20 bg-amber-400/10 text-amber-50",
  },
  planned: {
    label: "Planned",
    ringClassName: "border-orange-300/45 text-orange-300 shadow-[0_0_24px_rgba(249,115,22,0.16)]",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-orange-200/20 bg-[linear-gradient(145deg,rgba(249,115,22,0.95),rgba(234,88,12,0.82))] text-white",
    chipClassName: "border-orange-300/20 bg-orange-400/10 text-orange-50",
  },
  not_started: {
    label: "Not started",
    ringClassName: "border-slate-400/30 text-slate-300",
    coreClassName: "border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.12),rgba(30,41,59,0.92)_42%,rgba(15,23,42,0.98)_100%)]",
    badgeClassName: "border-white/10 bg-[linear-gradient(145deg,rgba(100,116,139,0.92),rgba(51,65,85,0.88))] text-white",
    chipClassName: "border-white/10 bg-white/[0.05] text-slate-200",
  },
};

function roundCoordinate(value, decimals = 6) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return String(Number(numericValue.toFixed(decimals)));
}

function normalizeHoleCollarSource(value, fallback = DEFAULT_HOLE_COLLAR_SOURCE) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (VALID_HOLE_COLLAR_SOURCES.has(normalizedValue)) return normalizedValue;
  return fallback;
}

function getMapWorkflowLightMeta(statusKey) {
  return MAP_WORKFLOW_LIGHT_META[statusKey] || MAP_WORKFLOW_LIGHT_META.not_started;
}

function MapWorkflowStatusIcon({ statusKey, className = "" }) {
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

  if (statusKey === "complete") {
    return (
      <svg {...sharedProps}>
        <path d="M5 12.5l4.2 4.2L19 7.8" />
      </svg>
    );
  }

  if (statusKey === "in_progress") {
    return (
      <svg {...sharedProps}>
        <path d="M12 6v6l4 2" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  if (statusKey === "planned") {
    return (
      <svg {...sharedProps}>
        <path d="M12 7v5" />
        <path d="M12 16h.01" />
        <circle cx="12" cy="12" r="8" />
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

function MapWorkflowActionIcon({ actionType, className = "" }) {
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

  if (actionType === "revert") {
    return (
      <svg {...sharedProps}>
        <path d="M10 7 5 12l5 5" />
        <path d="M6 12h8a5 5 0 0 1 0 10h-1" />
      </svg>
    );
  }

  if (actionType === "signoff") {
    return (
      <svg {...sharedProps}>
        <path d="M5 12.5l4.2 4.2L19 7.8" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <path d="M8 12h8" />
    </svg>
  );
}

function summariseMapWorkflowStepStatuses(steps) {
  if (!steps.length) return "not_started";
  if (steps.every((step) => step.statusKey === "complete")) return "complete";
  if (steps.some((step) => step.statusKey === "in_progress")) return "in_progress";
  if (steps.some((step) => step.statusKey === "complete")) return "in_progress";
  if (steps.some((step) => step.statusKey === "planned")) return "planned";
  return "not_started";
}

function deriveMapWorkflowStepStatusKey({
  explicitStatusKey,
  phaseIndex,
  substageIndex,
  currentPhaseIndex,
  currentSubstageIndex,
  currentStatusKey,
}) {
  if (explicitStatusKey) return explicitStatusKey;
  if (!currentPhaseIndex) return "not_started";
  if (phaseIndex < currentPhaseIndex) return "complete";
  if (phaseIndex > currentPhaseIndex) return "not_started";
  if (!currentSubstageIndex) return currentStatusKey || "planned";
  if (substageIndex < currentSubstageIndex) return "complete";
  if (substageIndex > currentSubstageIndex) return "not_started";
  return currentStatusKey || "planned";
}

function buildMapHoleWorkflowVisualModel({ workflow, hole, substageStatusById }) {
  if (!workflow || !hole?.current_workflow_id) return null;

  const visiblePhases = (workflow.namedPhases?.length ? workflow.namedPhases : workflow.phases || []).filter((phase) => String(phase?.name || "").trim());
  const currentPhase = visiblePhases.find((phase) => phase.id === hole.current_workflow_phase_id) || null;
  const currentSubstage = visiblePhases
    .flatMap((phase) => (phase.substages || []).map((substage) => ({ ...substage, workflow_phase_id: phase.id })))
    .find((substage) => substage.id === hole.current_workflow_substage_id) || null;

  const currentPhaseIndex = currentPhase?.phase_index || 0;
  const currentSubstageIndex = currentSubstage?.substage_index || 0;
  const phases = visiblePhases.map((phase) => {
    const steps = (phase.substages || [])
      .filter((substage) => String(substage?.name || "").trim())
      .map((substage) => {
        const runtime = substageStatusById[substage.id] || null;
        return {
          id: `substage:${substage.id}`,
          stepId: substage.id,
          phaseId: phase.id,
          title: substage.name,
          substageIndex: substage.substage_index,
          statusKey: deriveMapWorkflowStepStatusKey({
            explicitStatusKey: runtime?.status_key || "",
            phaseIndex: phase.phase_index,
            substageIndex: substage.substage_index,
            currentPhaseIndex,
            currentSubstageIndex,
            currentStatusKey: hole.current_workflow_status_key,
          }),
          isCurrent: hole.current_workflow_substage_id === substage.id,
        };
      });

    return {
      id: phase.id,
      phaseIndex: phase.phase_index,
      title: phase.name,
      description: phase.description || "",
      steps,
      statusKey: summariseMapWorkflowStepStatuses(steps),
    };
  });

  const orderedSteps = phases.flatMap((phase) => phase.steps);
  const currentStep = orderedSteps.find((step) => step.isCurrent) || orderedSteps.find((step) => step.statusKey !== "complete") || null;

  return {
    workflowId: workflow.id,
    phases,
    currentStepId: currentStep?.id || "",
  };
}

function getNextMapWorkflowSelection(workflowVisual, completedStepId) {
  const orderedSteps = (workflowVisual?.phases || []).flatMap((phase) => phase.steps || []);
  const nextIncompleteStep = orderedSteps.find((step) => {
    const effectiveStatusKey = step.id === completedStepId ? "complete" : step.statusKey;
    return effectiveStatusKey !== "complete";
  });

  if (!nextIncompleteStep) {
    const finalStep = orderedSteps.find((step) => step.id === completedStepId) || orderedSteps[orderedSteps.length - 1] || null;
    return {
      phaseId: finalStep?.phaseId || "",
      substageId: finalStep?.stepId || "",
      statusKey: "complete",
    };
  }

  return {
    phaseId: nextIncompleteStep.phaseId,
    substageId: nextIncompleteStep.stepId,
    statusKey: nextIncompleteStep.statusKey === "in_progress" ? "in_progress" : "planned",
  };
}

function getLatestCompletedMapWorkflowPhase(workflowVisual) {
  const completedPhases = (workflowVisual?.phases || []).filter((phase) => phase?.statusKey === "complete");
  if (!completedPhases.length) return null;
  return completedPhases.reduce((latestPhase, phase) => {
    if (!latestPhase) return phase;
    return (phase.phaseIndex || 0) > (latestPhase.phaseIndex || 0) ? phase : latestPhase;
  }, null);
}

function getLatestCompletedMapWorkflowStep(workflowVisual) {
  const orderedSteps = (workflowVisual?.phases || []).flatMap((phase) => phase.steps || []);
  const completedSteps = orderedSteps.filter((step) => step?.statusKey === "complete");
  return completedSteps[completedSteps.length - 1] || null;
}

function getMapWorkflowStepActionState({ workflowVisual, phase, step, canManageSelections }) {
  if (!workflowVisual || !phase || !step || !canManageSelections) {
    return {
      actionType: "none",
      canToggle: false,
      buttonLabel: canManageSelections ? "Unavailable" : "View only",
      helperText: canManageSelections ? "This substage is not available right now." : "Stage gate sign-off is available to admins in My Projects.",
    };
  }

  const orderedSteps = (workflowVisual.phases || []).flatMap((item) => item.steps || []);
  const actionableStep = orderedSteps.find((item) => item.id === workflowVisual.currentStepId) || orderedSteps.find((item) => item.statusKey !== "complete") || null;
  const latestCompletedStep = getLatestCompletedMapWorkflowStep(workflowVisual);

  if (step.statusKey === "complete") {
    if (latestCompletedStep?.id === step.id) {
      return {
        actionType: "revert",
        canToggle: true,
        buttonLabel: "Undo",
        helperText: `Undo ${step.title || "this substage"}.`,
      };
    }

    return {
      actionType: "none",
      canToggle: false,
      buttonLabel: "Signed off",
      helperText: "Only the most recent sign-off can be undone.",
    };
  }

  if (actionableStep?.id === step.id) {
    return {
      actionType: "signoff",
      canToggle: true,
      buttonLabel: "Sign off",
      helperText: `Sign off ${step.title || "this substage"} to advance this stage gate.`,
    };
  }

  return {
    actionType: "none",
    canToggle: false,
    buttonLabel: "Locked",
    helperText: actionableStep?.phaseId === phase.id ? "Complete the current substage before moving forward." : "This stage gate is not currently active.",
  };
}

function getMapWorkflowPhaseActionState({ workflowVisual, phase, canManageSelections }) {
  if (!workflowVisual || !phase || !canManageSelections) {
    return {
      actionStep: null,
      actionType: "none",
      canToggle: false,
      helperText: canManageSelections ? "This stage gate is view only right now." : "Stage gate sign-off is available to admins in My Projects.",
    };
  }

  const orderedSteps = (workflowVisual.phases || []).flatMap((item) => item.steps || []);
  const actionableStep = orderedSteps.find((step) => step.id === workflowVisual.currentStepId) || orderedSteps.find((step) => step.statusKey !== "complete") || null;
  const latestCompletedPhase = getLatestCompletedMapWorkflowPhase(workflowVisual);
  const revertStep = phase.statusKey === "complete" && latestCompletedPhase?.id === phase.id
    ? [...(phase.steps || [])].reverse().find((step) => step.statusKey === "complete") || null
    : null;

  if (revertStep) {
    return {
      actionStep: revertStep,
      actionType: "revert",
      canToggle: true,
      helperText: `Undo the most recent sign-off in ${phase.title}.`,
    };
  }

  if (actionableStep?.phaseId === phase.id) {
    return {
      actionStep: actionableStep,
      actionType: "signoff",
      canToggle: true,
      helperText: `Sign off ${actionableStep.title} to advance this stage gate.`,
    };
  }

  return {
    actionStep: null,
    actionType: "none",
    canToggle: false,
    helperText: phase.statusKey === "complete"
      ? "Only the latest completed stage gate can be reverted."
      : "This stage gate is not currently active.",
  };
}

function MapWorkflowStageStrip({ workflowVisual, selectedHole, canManageSelections, signingPhaseId, onSelectPhase, selectedPhaseId = "" }) {
  const actionableStep = useMemo(() => {
    const orderedSteps = (workflowVisual?.phases || []).flatMap((phase) => phase.steps || []);
    return orderedSteps.find((step) => step.id === workflowVisual?.currentStepId) || orderedSteps.find((step) => step.statusKey !== "complete") || null;
  }, [workflowVisual]);
  const latestCompletedPhaseId = useMemo(() => getLatestCompletedMapWorkflowPhase(workflowVisual)?.id || "", [workflowVisual]);

  if (!selectedHole) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        Select a hole on the map to view and action its workflow.
      </div>
    );
  }

  if (!workflowVisual) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        This hole does not have a configured workflow yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,47,73,0.22),rgba(15,23,42,0.82),rgba(30,41,59,0.52))] p-3 shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-3 py-3">
        <div className="grid grid-cols-5 gap-2 md:gap-2.5">
        {Array.from({ length: 5 }, (_, index) => {
          const phaseNumber = index + 1;
          const phase = workflowVisual.phases.find((item) => item.phaseIndex === phaseNumber) || null;
          const phaseMeta = getMapWorkflowLightMeta(phase?.statusKey || "not_started");
          const completedCount = phase?.steps.filter((step) => step.statusKey === "complete").length || 0;
          const stepCount = phase?.steps.length || 0;
          const isActionable = !!phase && !!actionableStep && actionableStep.phaseId === phase.id && canManageSelections;
          const isRevertable = !!phase && phase.statusKey === "complete" && phase.id === latestCompletedPhaseId && canManageSelections;
          const isToggleable = isActionable || isRevertable;
          const isSigning = signingPhaseId === phase?.id;
          const isSelected = selectedPhaseId === phase?.id;

          return (
            <div key={`map-workflow-phase-${phaseNumber}`} className="relative flex flex-col items-center text-center">
              {phaseNumber < 5 ? (
                <div className="pointer-events-none absolute left-[calc(50%+2rem)] right-[-18%] top-[2rem] hidden h-px md:block">
                  <div className="relative h-px w-full bg-gradient-to-r from-white/0 via-white/15 to-white/0">
                    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-slate-300/70" />
                  </div>
                </div>
              ) : null}

              <button
                key={`map-workflow-phase-button-${phaseNumber}`}
                type="button"
                disabled={!phase}
                onClick={() => phase && onSelectPhase(phase)}
                className={[
                  "group relative flex w-full flex-col items-center text-center",
                  !phase ? "cursor-default" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-[4px] bg-transparent transition-base md:h-[60px] md:w-[60px] lg:h-[64px] lg:w-[64px]",
                    phaseMeta.ringClassName,
                    isSelected
                      ? "scale-[1.05] shadow-[0_0_0_6px_rgba(34,211,238,0.18),0_0_0_12px_rgba(34,211,238,0.08)]"
                      : isToggleable
                      ? "scale-[1.04] shadow-[0_0_0_6px_rgba(34,211,238,0.12),0_0_0_10px_rgba(34,211,238,0.05)]"
                      : phase
                        ? "group-hover:scale-[1.02]"
                        : "",
                  ].join(" ")}
                >
                  {isSelected || isToggleable ? (
                    <span className="pointer-events-none absolute inset-[-8px] rounded-full border border-cyan-300/25" />
                  ) : null}
                  <span className="absolute -top-1 h-2 w-2 rounded-full bg-current opacity-85" />
                  <div className={[
                    "relative flex h-[40px] w-[40px] flex-col items-center justify-center rounded-full border text-center md:h-[46px] md:w-[46px] lg:h-[50px] lg:w-[50px]",
                    phaseMeta.coreClassName,
                  ].join(" ")}>
                    <span className="pointer-events-none absolute inset-[14%] rounded-full border border-white/8" />
                    <span className={[
                      "relative flex h-6 w-6 items-center justify-center rounded-xl border md:h-7 md:w-7 lg:h-8 lg:w-8",
                      phaseMeta.badgeClassName,
                    ].join(" ")}>
                      <MapWorkflowStatusIcon statusKey={phase?.statusKey || "not_started"} className="h-3.5 w-3.5 md:h-4 md:w-4 lg:h-4.5 lg:w-4.5" />
                    </span>
                  </div>
                </div>

                <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] md:px-2.5 md:text-[10px] ${phaseMeta.chipClassName}`}>
                  Stage Gate {phaseNumber}
                </div>
                <div className={[
                  "mt-1.5 text-xs font-semibold leading-tight md:text-sm lg:text-base lg:leading-none",
                  isSelected || isToggleable ? "text-cyan-50" : "text-white",
                ].join(" ")}>{phase?.title || "Unused"}</div>
              </button>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function MapWorkflowPhaseDrawer({ open, selectedHole, phase, workflowVisual, canManageSelections, signingPhaseId, signingStepId, onClose, onToggleStep }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [activePhase, setActivePhase] = useState(phase);

  useEffect(() => {
    if (phase) {
      setActivePhase(phase);
    }
  }, [phase]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const animationFrame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }

    setVisible(false);
    const timeoutId = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mounted, onClose]);

  const actionState = useMemo(
    () => getMapWorkflowPhaseActionState({ workflowVisual, phase: activePhase, canManageSelections }),
    [activePhase, canManageSelections, workflowVisual]
  );

  if (!mounted || !activePhase) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end bg-slate-950/58 backdrop-blur-sm" onClick={onClose}>
      <div
        className={[
          "w-full rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_-24px_80px_rgba(2,6,23,0.48)] transition duration-200 ease-out",
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-workflow-phase-drawer-title"
      >
        <div className="mx-auto flex max-w-4xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 md:px-6">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />

          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Stage Gate</div>
              <div id="map-workflow-phase-drawer-title" className="mt-2 text-xl font-semibold text-white">
                {activePhase.title || "Unnamed stage gate"}
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {selectedHole?.hole_id ? `${selectedHole.hole_id} · ${activePhase.steps.length} substage${activePhase.steps.length === 1 ? "" : "s"}` : `${activePhase.steps.length} substage${activePhase.steps.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
            >
              Close
            </button>
          </div>

          <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {(activePhase.steps || []).map((step, index) => {
              const stepMeta = getMapWorkflowLightMeta(step.statusKey || "not_started");
              const stepActionState = getMapWorkflowStepActionState({ workflowVisual, phase: activePhase, step, canManageSelections });
              const isSigningStep = signingStepId === step.id;
              return (
                <div
                  key={step.id || `phase-step-${index}`}
                  className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={[
                        "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                        stepMeta.badgeClassName,
                      ].join(" ")}>
                        <MapWorkflowStatusIcon statusKey={step.statusKey || "not_started"} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{step.title || `Substage ${index + 1}`}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {step.isCurrent ? "Current substage" : step.statusKey === "complete" ? "Signed off" : step.statusKey === "in_progress" ? "In progress" : step.statusKey === "planned" ? "Planned" : "Not started"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className={[
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
                        stepMeta.chipClassName,
                      ].join(" ")}>
                        {step.statusKey === "complete" ? "Signed off" : step.statusKey === "in_progress" ? "In progress" : step.statusKey === "planned" ? "Planned" : "Not started"}
                      </span>

                      <button
                        type="button"
                        disabled={!stepActionState.canToggle || isSigningStep || signingPhaseId === activePhase.id}
                        onClick={() => onToggleStep(activePhase, step)}
                        aria-label={isSigningStep
                          ? stepActionState.actionType === "revert"
                            ? `Undoing ${step.title || "substage"}`
                            : `Signing off ${step.title || "substage"}`
                          : `${stepActionState.buttonLabel} ${step.title || "substage"}`}
                        title={isSigningStep
                          ? stepActionState.actionType === "revert"
                            ? `Undoing ${step.title || "substage"}`
                            : `Signing off ${step.title || "substage"}`
                          : `${stepActionState.buttonLabel} ${step.title || "substage"}`}
                        className={[
                          "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                          stepActionState.canToggle
                            ? stepActionState.actionType === "revert"
                              ? "border-amber-300/30 bg-amber-300/10 text-amber-50 hover:bg-amber-300/16"
                              : "border-cyan-300/30 bg-[linear-gradient(145deg,rgba(34,211,238,0.18),rgba(14,116,144,0.22))] text-cyan-50 shadow-[0_12px_30px_rgba(34,211,238,0.14)] hover:border-cyan-200/50 hover:bg-cyan-300/18"
                            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-400",
                        ].join(" ")}
                      >
                        <MapWorkflowActionIcon
                          actionType={stepActionState.actionType}
                          className={["h-4.5 w-4.5", isSigningStep ? "animate-spin" : ""].join(" ")}
                        />
                      </button>
                      <div className="max-w-[16rem] text-xs text-slate-400 md:text-right">{stepActionState.helperText}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 text-sm text-slate-300">{actionState.helperText}</div>
        </div>
      </div>
    </div>
  );
}

function createMapHoleDraft(projectId = "") {
  return {
    project_id: projectId,
    hole_id: "",
    state: "proposed",
    longitude: "",
    latitude: "",
    collar_source: DEFAULT_HOLE_COLLAR_SOURCE,
  };
}

function createMapAssetDraft(projectId = "") {
  return {
    project_id: projectId,
    name: "",
    asset_type_id: "",
    location_id: "",
    status: "Active",
    longitude: "",
    latitude: "",
    coordinate_source: "manual",
  };
}

function makeCreatePointCollection(point) {
  if (!point?.longitude || !point?.latitude) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(point.longitude), Number(point.latitude)],
        },
        properties: {},
      },
    ],
  };
}

const HOLE_STATE_COLOR_EXPRESSION = [
  "match",
  ["get", "state"],
  "drilled",
  "#22c55e",
  "in_progress",
  "#f59e0b",
  "#38bdf8",
];

function cinematicEase(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getSelectionFlyTo(map, center, minimumZoom) {
  return {
    center,
    zoom: Math.max(map.getZoom(), minimumZoom),
    speed: MAP_REFOCUS_SPEED,
    curve: MAP_REFOCUS_CURVE,
    easing: cinematicEase,
    essential: true,
  };
}

function getHoleStateTone(state) {
  if (state === "drilled") {
    return {
      label: "Drilled",
      text: "#bbf7d0",
      border: "rgba(34,197,94,0.35)",
      background: "rgba(34,197,94,0.16)",
    };
  }

  if (state === "in_progress") {
    return {
      label: "In Progress",
      text: "#fde68a",
      border: "rgba(251,191,36,0.35)",
      background: "rgba(251,191,36,0.16)",
    };
  }

  return {
    label: state ? String(state).replace(/_/g, " ") : "Proposed",
    text: "#bae6fd",
    border: "rgba(34,211,238,0.35)",
    background: "rgba(34,211,238,0.16)",
  };
}

function formatDescriptorSummary(descriptors) {
  if (!descriptors?.length) return "-";
  return descriptors.map((descriptor) => descriptor.name).join(", ");
}

function createEmptyMapAdvancedFilters() {
  return {
    descriptorId: [],
    holeState: [],
    holeCompletionStatus: [],
    assetStatus: [],
    assetTypeId: [],
    assetLocationId: [],
  };
}

function normalizeMultiFilterValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  return [];
}

function normalizeMapAdvancedFilters(value) {
  const empty = createEmptyMapAdvancedFilters();
  if (!value || typeof value !== "object") return empty;

  return {
    descriptorId: normalizeMultiFilterValue(value.descriptorId),
    holeState: normalizeMultiFilterValue(value.holeState),
    holeCompletionStatus: normalizeMultiFilterValue(value.holeCompletionStatus),
    assetStatus: normalizeMultiFilterValue(value.assetStatus),
    assetTypeId: normalizeMultiFilterValue(value.assetTypeId),
    assetLocationId: normalizeMultiFilterValue(value.assetLocationId),
  };
}

function countActiveMapAdvancedFilters(filters) {
  return Object.values(filters || {}).filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length;
}

function formatFilterOptionLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function FilterMultiSelect({ label, values, onChange, emptyLabel, options }) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(() => {
    const selected = new Set(values || []);
    return (options || []).filter((option) => selected.has(option.value)).map((option) => option.label);
  }, [options, values]);

  const toggleValue = (nextValue) => {
    const currentValues = Array.isArray(values) ? values : [];
    const exists = currentValues.includes(nextValue);
    onChange(exists ? currentValues.filter((value) => value !== nextValue) : [...currentValues, nextValue]);
  };

  return (
    <div className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
      <div>{label}</div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium normal-case tracking-normal text-slate-100">
              {selectedLabels.length ? selectedLabels.join(", ") : emptyLabel}
            </div>
            <div className="mt-1 text-[11px] normal-case tracking-normal text-slate-400">
              {selectedLabels.length ? `${selectedLabels.length} selected` : "No filters applied"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedLabels.length ? (
              <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">
                {selectedLabels.length}
              </span>
            ) : null}
            <OverviewToggleIcon collapsed={!open} className="h-4 w-4 text-slate-300" />
          </div>
        </button>

        {open ? (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {options.map((option) => {
                const checked = (values || []).includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm normal-case tracking-normal transition ${checked ? "border-cyan-300/28 bg-cyan-400/[0.08] text-slate-100" : "border-white/8 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]"}`}
                  >
                    <span className="truncate">{option.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/70 text-cyan-300"
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium normal-case tracking-normal text-slate-200 transition hover:bg-white/[0.1]"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssetTypeNavigatorFilter({ value, onChange, options, resultCount, compact = false }) {
  const hasActiveFilter = !!value;

  return (
    <div className={compact ? "px-4 pb-2 pt-3" : "px-4 pb-3 pt-4 md:px-5"}>
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_12px_28px_rgba(2,6,23,0.14)]">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Asset Type</div>
            <div className="mt-1 text-xs text-slate-300">Filter the navigator without opening advanced filters.</div>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/55 px-2.5 py-1 text-[11px] text-slate-300">
            {resultCount} shown
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3.5 text-sm font-medium text-slate-100 outline-none transition focus:border-rose-300/40"
          >
            <option value="">All asset types</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasActiveFilter ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-11 shrink-0 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.1]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HoleStateLegend() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/72 px-2.5 py-2 shadow-[0_14px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div className="flex flex-col items-stretch gap-2 whitespace-nowrap">
        {HOLE_STATE_STYLES.map((item) => (
          <div key={item.value} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200">
            <span className="h-2 w-2 rounded-full ring-2 ring-slate-950/70" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
        {ASSET_STATUS_STYLES.map((item) => (
          <div key={item.value} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200">
            <span className="h-2 w-2 rounded-full ring-2 ring-slate-950/70" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyProjectPrompt({ compact = false }) {
  return (
    <div
      className={compact ? "p-4" : "p-5"}
    >
      <div className="rounded-[28px] border border-dashed border-cyan-300/25 bg-[linear-gradient(180deg,rgba(8,47,73,0.32),rgba(2,6,23,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Get Started</div>
        <h3 className="mt-3 text-xl font-semibold text-white">No projects yet</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
          Create your first project to start mapping drillholes, viewing collar positions, and navigating between hole programs.
        </p>
        <Link
          href="/projects?tab=projects"
          className="mt-5 inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#38bdf8)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105"
        >
          Create A Project
        </Link>
      </div>
    </div>
  );
}

function formatValue(value, suffix = "") {
  if (value == null || value === "") return "-";
  return `${value}${suffix}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toNullableNumber(value) {
  if (value === "" || value == null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toTextOrNull(value) {
  const trimmedValue = String(value || "").trim();
  return trimmedValue || null;
}

function getMapEntityLabel(entityType, entity) {
  if (entityType === "hole") return entity?.hole_id || "Unnamed hole";
  return entity?.name || "Unnamed asset";
}

function getMapProposalEntityKey(entityType, entityId) {
  return `${entityType}:${entityId || ""}`;
}

function formatCoordinatePreview(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return numericValue.toFixed(6);
}

function markViewportForPreserve(ref) {
  ref.current = true;
}

function makeHoleFeatureCollection(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((hole) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(hole.collar_longitude), Number(hole.collar_latitude)],
      },
      properties: {
        id: hole.id,
        hole_id: hole.hole_id || "Unnamed hole",
        project_id: hole.project_id || "",
        project_name: hole.project_name || "No project",
        state: hole.state || "",
        depth: hole.depth ?? "",
        planned_depth: hole.planned_depth ?? "",
        water_level_m: hole.water_level_m ?? "",
        azimuth: hole.azimuth ?? "",
        dip: hole.dip ?? "",
      },
    })),
  };
}

function makeAssetFeatureCollection(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((asset) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(asset.longitude), Number(asset.latitude)],
      },
      properties: {
        id: asset.id,
        name: asset.name || "Unnamed asset",
        project_id: asset.project_id || "",
        project_name: asset.project_name || "No project",
        status: asset.status || "",
        asset_type_name: asset.asset_type_name || "-",
        location_name: asset.location_name || "-",
        coordinate_source: asset.coordinate_source || "",
      },
    })),
  };
}

function makeMapLocationProposalFeatureCollection(proposals, holes, assets) {
  const holeById = new Map((holes || []).map((hole) => [hole.id, hole]));
  const assetById = new Map((assets || []).map((asset) => [asset.id, asset]));
  const features = [];

  (proposals || []).forEach((proposal) => {
    const entity = proposal.entity_type === "hole"
      ? holeById.get(proposal.entity_id)
      : assetById.get(proposal.entity_id);

    if (!entity) return;

    const currentLongitude = Number(proposal.entity_type === "hole" ? entity.collar_longitude : entity.longitude);
    const currentLatitude = Number(proposal.entity_type === "hole" ? entity.collar_latitude : entity.latitude);
    const proposedLongitude = Number(proposal.proposed_longitude);
    const proposedLatitude = Number(proposal.proposed_latitude);

    if (![currentLongitude, currentLatitude, proposedLongitude, proposedLatitude].every(Number.isFinite)) return;

    const color = proposal.entity_type === "hole" ? "#f59e0b" : "#f472b6";
    const label = getMapEntityLabel(proposal.entity_type, entity);

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [currentLongitude, currentLatitude],
          [proposedLongitude, proposedLatitude],
        ],
      },
      properties: {
        proposal_id: proposal.id,
        entity_type: proposal.entity_type,
        entity_id: proposal.entity_id,
        color,
        label,
        feature_kind: "connector",
      },
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [proposedLongitude, proposedLatitude],
      },
      properties: {
        proposal_id: proposal.id,
        entity_type: proposal.entity_type,
        entity_id: proposal.entity_id,
        color,
        label,
        feature_kind: "proposal_point",
      },
    });
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function deriveMapAssetCoordinates(asset) {
  const longitude = asset?.longitude ?? null;
  const latitude = asset?.latitude ?? null;
  if (longitude != null && latitude != null) {
    return { longitude, latitude, coordinateDerived: false };
  }

  if (asset?.easting == null || asset?.northing == null || !asset?.project_crs_code) {
    return { longitude, latitude, coordinateDerived: false };
  }

  try {
    const converted = convertProjectedToWgs84({
      crsCode: asset.project_crs_code,
      easting: asset.easting,
      northing: asset.northing,
    });

    return {
      longitude: converted.longitude,
      latitude: converted.latitude,
      coordinateDerived: true,
    };
  } catch {
    return { longitude, latitude, coordinateDerived: false };
  }
}

function ProjectAccordionList({
  loading,
  projects,
  expandedProjects,
  onToggleProject,
  selectedHoleId,
  onSelectHole,
  compact = false,
}) {
  if (loading) {
    return (
      <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
        {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
          <div key={index} className={`animate-pulse rounded-2xl bg-white/[0.05] ${compact ? "h-24" : "h-20"}`} />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return <EmptyProjectPrompt compact={compact} />;
  }

  return (
    <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
      {projects.map((project) => {
        const isExpanded = expandedProjects[project.id] === true;
        return (
          <div
            key={project.id}
            className={`overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.66),rgba(2,6,23,0.92))] ${compact ? "rounded-[26px]" : "rounded-3xl"}`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
              onClick={() => onToggleProject(project, isExpanded)}
            >
              <div className="min-w-0">
                <div className={`truncate font-semibold text-white ${compact ? "text-[15px]" : "text-sm"}`}>{project.name}</div>
                <div className="mt-1 text-xs text-slate-400">{project.holes.length} mapped hole{project.holes.length === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                {isExpanded ? "Hide" : "Show"}
              </div>
            </button>

            {isExpanded ? (
              <div className="space-y-2 border-t border-white/10 px-3 py-3">
                {project.holes.map((hole) => {
                  const isSelected = selectedHoleId === hole.id;
                  return (
                    <button
                      key={hole.id}
                      type="button"
                      onClick={() => onSelectHole(hole)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-amber-300/50 bg-amber-300/12 shadow-[0_10px_32px_rgba(251,191,36,0.14)]" : "border-white/8 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{hole.hole_id}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {formatValue(hole.planned_depth, "m")} planned · {formatValue(hole.depth, "m")} drilled
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
                        {hole.state || "-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AssetAccordionList({
  loading,
  projects,
  expandedProjects,
  onToggleProject,
  selectedAssetId,
  onSelectAsset,
  activeTypeLabel = "",
  compact = false,
}) {
  if (loading) {
    return (
      <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
        {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
          <div key={index} className={`animate-pulse rounded-2xl bg-white/[0.05] ${compact ? "h-24" : "h-20"}`} />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className={compact ? "p-4" : "p-5"}>
        <div className="rounded-[28px] border border-dashed border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(2,6,23,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Mapped Assets</div>
          <h3 className="mt-3 text-xl font-semibold text-white">{activeTypeLabel ? "No assets match this type" : "No assets with map coordinates"}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            {activeTypeLabel
              ? `${activeTypeLabel} assets are not in the current project scope or map filter. Try a different type or clear the filter.`
              : "Add longitude and latitude, or save projected easting and northing against a project CRS, to show assets on the map."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
      {projects.map((project) => {
        const isExpanded = expandedProjects[project.id] === true;
        return (
          <div
            key={project.id}
            className={`overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.66),rgba(2,6,23,0.92))] ${compact ? "rounded-[26px]" : "rounded-3xl"}`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
              onClick={() => onToggleProject(project, isExpanded)}
            >
              <div className="min-w-0">
                <div className={`truncate font-semibold text-white ${compact ? "text-[15px]" : "text-sm"}`}>{project.name}</div>
                <div className="mt-1 text-xs text-slate-400">{project.assets.length} mapped asset{project.assets.length === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                {isExpanded ? "Hide" : "Show"}
              </div>
            </button>

            {isExpanded ? (
              <div className="space-y-2 border-t border-white/10 px-3 py-3">
                {project.assets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onSelectAsset(asset)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-rose-300/50 bg-rose-300/12 shadow-[0_10px_32px_rgba(244,114,182,0.16)]" : "border-white/8 bg-white/[0.03] hover:border-rose-300/30 hover:bg-rose-300/[0.06]"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{asset.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {asset.asset_type_name || "Unknown type"} · {asset.location_name || "No location"}
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
                        {asset.status || "-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HoleAttributesPanel({ selectedHole, canManage = false, onEdit, onDelete, deleting = false, mobile = false }) {
  if (mobile) {
    return (
      <div className="space-y-3 p-4">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.68)_45%,rgba(120,53,15,0.42))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Selected Hole</div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-white">{selectedHole?.hole_id || "No hole selected"}</div>
              <div className="mt-1 text-sm text-slate-300">{selectedHole?.project_name || "Tap a project or point to inspect detail"}</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
              {selectedHole?.state || "-"}
            </div>
          </div>
          {canManage && selectedHole ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/16"
              >
                Edit Hole
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Hole"}
              </button>
            </div>
          ) : null}
          {selectedHole?.descriptors?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedHole.descriptors.map((descriptor) => (
                <span key={descriptor.id} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                  {descriptor.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Planned Depth", formatValue(selectedHole?.planned_depth, " m")],
            ["Water", formatValue(selectedHole?.water_level_m, " m")],
            ["Elevation", formatValue(selectedHole?.collar_elevation_m, " m")],
            ["Easting", formatValue(selectedHole?.collar_easting)],
            ["Northing", formatValue(selectedHole?.collar_northing)],
            ["Azimuth", formatValue(selectedHole?.azimuth, "°")],
            ["Dip", formatValue(selectedHole?.dip, "°")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-2 text-base font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/55 p-4">
          {[
            ["Collar Source", selectedHole?.collar_source || "-"],
            ["Longitude", formatValue(selectedHole?.collar_longitude)],
            ["Latitude", formatValue(selectedHole?.collar_latitude)],
            ["Started", formatDateTime(selectedHole?.started_at)],
            ["Completed", formatDateTime(selectedHole?.completed_at)],
            ["Completion Status", selectedHole?.completion_status || "-"],
            ["Completion Notes", selectedHole?.completion_notes || "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-100">{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canManage && selectedHole ? (
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/16"
          >
            Edit Hole
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-300/16 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete Hole"}
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-200">
        <tbody>
          <tr className="border-b border-white/10">
            <th className="w-56 bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Project</th>
            <td className="px-4 py-3">{selectedHole?.project_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Hole ID</th>
            <td className="px-4 py-3">{selectedHole?.hole_id || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">State</th>
            <td className="px-4 py-3">{selectedHole?.state || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Descriptors</th>
            <td className="px-4 py-3">{formatDescriptorSummary(selectedHole?.descriptors)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Planned Depth</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.planned_depth, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Water Level</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.water_level_m, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Azimuth</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.azimuth, "°")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Dip</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.dip, "°")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Longitude</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_longitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Latitude</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_latitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Easting</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_easting)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Northing</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_northing)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Elevation</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_elevation_m, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Collar Source</th>
            <td className="px-4 py-3">{selectedHole?.collar_source || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Started</th>
            <td className="px-4 py-3">{formatDateTime(selectedHole?.started_at)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completed</th>
            <td className="px-4 py-3">{formatDateTime(selectedHole?.completed_at)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completion Status</th>
            <td className="px-4 py-3">{selectedHole?.completion_status || "-"}</td>
          </tr>
          <tr>
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completion Notes</th>
            <td className="px-4 py-3">{selectedHole?.completion_notes || "-"}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}

function AssetAttributesPanel({ selectedAsset, canManage = false, onEdit, onDelete, deleting = false, mobile = false }) {
  if (mobile) {
    return (
      <div className="space-y-3 p-4">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.68)_45%,rgba(8,145,178,0.28))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Selected Asset</div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-white">{selectedAsset?.name || "No asset selected"}</div>
              <div className="mt-1 text-sm text-slate-300">{selectedAsset?.project_name || "Tap an asset marker or list item to inspect detail"}</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
              {selectedAsset?.status || "-"}
            </div>
          </div>
          {canManage && selectedAsset ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/16"
              >
                Edit Asset
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-300/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Asset"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Type", selectedAsset?.asset_type_name || "-"],
            ["Location", selectedAsset?.location_name || "-"],
            ["Easting", formatValue(selectedAsset?.easting)],
            ["Northing", formatValue(selectedAsset?.northing)],
            ["Longitude", formatValue(selectedAsset?.longitude)],
            ["Latitude", formatValue(selectedAsset?.latitude)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-2 text-base font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/55 p-4">
          {[
            ["Project", selectedAsset?.project_name || "-"],
            ["Coordinate Source", selectedAsset?.coordinate_source || "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-100">{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canManage && selectedAsset ? (
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/16"
          >
            Edit Asset
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-300/16 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete Asset"}
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-200">
        <tbody>
          <tr className="border-b border-white/10">
            <th className="w-56 bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Project</th>
            <td className="px-4 py-3">{selectedAsset?.project_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Asset</th>
            <td className="px-4 py-3">{selectedAsset?.name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Status</th>
            <td className="px-4 py-3">{selectedAsset?.status || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Type</th>
            <td className="px-4 py-3">{selectedAsset?.asset_type_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Location</th>
            <td className="px-4 py-3">{selectedAsset?.location_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Longitude</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.longitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Latitude</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.latitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Easting</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.easting)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Northing</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.northing)}</td>
          </tr>
          <tr>
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Coordinate Source</th>
            <td className="px-4 py-3">{selectedAsset?.coordinate_source || "-"}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}

function HoleEditorModal({ hole, projects, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    project_id: "",
    hole_id: "",
    state: "proposed",
    planned_depth: "",
    depth: "",
    water_level_m: "",
    azimuth: "",
    dip: "",
    collar_longitude: "",
    collar_latitude: "",
    collar_source: "",
    completion_status: "",
    completion_notes: "",
  });

  useEffect(() => {
    if (!hole) return;
    setForm({
      project_id: hole.project_id || "",
      hole_id: hole.hole_id || "",
      state: hole.state || "proposed",
      planned_depth: hole.planned_depth ?? "",
      depth: hole.depth ?? "",
      water_level_m: hole.water_level_m ?? "",
      azimuth: hole.azimuth ?? "",
      dip: hole.dip ?? "",
      collar_longitude: hole.collar_longitude ?? "",
      collar_latitude: hole.collar_latitude ?? "",
      collar_source: hole.collar_source || "",
      completion_status: hole.completion_status || "",
      completion_notes: hole.completion_notes || "",
    });
  }, [hole]);

  useEffect(() => {
    if (!hole) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hole, onClose, saving]);

  if (!hole) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/78 backdrop-blur-md" onClick={() => (!saving ? onClose() : null)}>
      <div className="flex h-full w-full items-center justify-center p-3 md:p-6">
        <div
          className="flex h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_30px_120px_rgba(2,6,23,0.5)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="map-hole-editor-title"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Map Admin</div>
              <div id="map-hole-editor-title" className="mt-2 text-2xl font-semibold text-white">Edit Hole</div>
              <div className="mt-1 text-sm text-slate-300">Update the selected hole directly from the map view.</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Project
                <select value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Hole ID
                <input value={form.hole_id} onChange={(event) => setForm((current) => ({ ...current, hole_id: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                State
                <select value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="proposed">Proposed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="drilled">Drilled</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Planned Depth (m)
                <input value={form.planned_depth} onChange={(event) => setForm((current) => ({ ...current, planned_depth: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Actual Depth (m)
                <input value={form.depth} onChange={(event) => setForm((current) => ({ ...current, depth: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Water Level (m)
                <input value={form.water_level_m} onChange={(event) => setForm((current) => ({ ...current, water_level_m: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Azimuth
                <input value={form.azimuth} onChange={(event) => setForm((current) => ({ ...current, azimuth: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Dip
                <input value={form.dip} onChange={(event) => setForm((current) => ({ ...current, dip: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Longitude
                <input value={form.collar_longitude} onChange={(event) => setForm((current) => ({ ...current, collar_longitude: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Latitude
                <input value={form.collar_latitude} onChange={(event) => setForm((current) => ({ ...current, collar_latitude: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Collar Source
                <input value={form.collar_source} onChange={(event) => setForm((current) => ({ ...current, collar_source: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Completion Status
                <input value={form.completion_status} onChange={(event) => setForm((current) => ({ ...current, completion_status: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Completion Notes
                <textarea value={form.completion_notes} onChange={(event) => setForm((current) => ({ ...current, completion_notes: event.target.value }))} className="min-h-32 rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4 md:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" onClick={() => onSave(form)} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0ea5e9)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save Hole"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetEditorModal({ asset, projects, assetTypes, assetLocations, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    project_id: "",
    name: "",
    asset_type_id: "",
    location_id: "",
    status: "Active",
    longitude: "",
    latitude: "",
    coordinate_source: "manual",
  });

  useEffect(() => {
    if (!asset) return;
    setForm({
      project_id: asset.project_id || "",
      name: asset.name || "",
      asset_type_id: asset.asset_type_id || "",
      location_id: asset.location_id || "",
      status: asset.status || "Active",
      longitude: asset.longitude ?? "",
      latitude: asset.latitude ?? "",
      coordinate_source: asset.coordinate_source || "manual",
    });
  }, [asset]);

  useEffect(() => {
    if (!asset) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [asset, onClose, saving]);

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/78 backdrop-blur-md" onClick={() => (!saving ? onClose() : null)}>
      <div className="flex h-full w-full items-center justify-center p-3 md:p-6">
        <div
          className="flex h-[min(92vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_30px_120px_rgba(2,6,23,0.5)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="map-asset-editor-title"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Map Admin</div>
              <div id="map-asset-editor-title" className="mt-2 text-2xl font-semibold text-white">Edit Asset</div>
              <div className="mt-1 text-sm text-slate-300">Update the selected asset directly from the map view.</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Project
                <select value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Asset Name
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Asset Type
                <select value={form.asset_type_id} onChange={(event) => setForm((current) => ({ ...current, asset_type_id: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="">Select asset type...</option>
                  {assetTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Location
                <select value={form.location_id} onChange={(event) => setForm((current) => ({ ...current, location_id: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="">Select location...</option>
                  {assetLocations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Status
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Longitude
                <input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Latitude
                <input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Coordinate Source
                <input value={form.coordinate_source} onChange={(event) => setForm((current) => ({ ...current, coordinate_source: event.target.value }))} className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40" />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4 md:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" onClick={() => onSave(form)} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0ea5e9)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save Asset"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HoleSchematicModal({
  hole,
  loading,
  error,
  geologyRows,
  constructionRows,
  annulusRows,
  lithById,
  constructionById,
  annulusById,
  onClose,
}) {
  useEffect(() => {
    if (!hole) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hole, onClose]);

  if (!hole) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/78 backdrop-blur-md" onClick={onClose}>
      <div className="flex h-full w-full items-center justify-center p-3 md:p-6">
        <div
          className="flex h-[min(92vh,980px)] w-full max-w-[1500px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_30px_120px_rgba(2,6,23,0.5)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hole-schematic-title"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Hole Schematic</div>
              <div id="hole-schematic-title" className="mt-2 text-2xl font-semibold text-white">
                {hole.hole_id || "Unnamed hole"}
              </div>
              <div className="mt-1 text-sm text-slate-300">{hole.project_name || "No project"}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
            >
              Back To Map
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 md:p-5">
            {loading ? (
              <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)]">
                <div className="h-[620px] animate-pulse rounded-3xl bg-white/[0.05]" />
                <div className="h-[620px] animate-pulse rounded-3xl bg-white/[0.05]" />
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">{error}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Planned Depth</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.planned_depth, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Actual Depth</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.depth, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Water</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.water_level_m, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Status</div>
                    <div className="mt-2 text-lg font-semibold text-white">{hole.state || "-"}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-slate-950/40 p-3 md:p-5">
                  <div className="inline-flex min-w-max items-start gap-3">
                    <DepthAxisBar plannedDepth={hole.planned_depth} actualDepth={hole.depth} waterLevel={hole.water_level_m} />

                    <BoreholeSchematicPreview
                      plannedDepth={hole.planned_depth}
                      actualDepth={hole.depth}
                      waterLevel={hole.water_level_m}
                      geologyIntervals={geologyRows}
                      lithById={lithById}
                      annulusIntervals={annulusRows}
                      annulusById={annulusById}
                      constructionIntervals={constructionRows}
                      constructionById={constructionById}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DockGripIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="7" r="1.5" fill="currentColor" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16" cy="7" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function DockMoveIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 4v16M4 12h16M12 4l-2.5 2.5M12 4l2.5 2.5M12 20l-2.5-2.5M12 20l2.5-2.5M4 12l2.5-2.5M4 12l2.5 2.5M20 12l-2.5-2.5M20 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DockDuplicateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="8" y="8" width="10" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DockProposalIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 8.2v5.6M9.2 11h5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DockReviewIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 12.5 9 17l11-11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DockSchematicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="8" y="3.5" width="8" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.5 8h3M10.5 12h3M10.5 16h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function FullscreenEnterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenExitIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9 4 4M15 9l5-5M15 15l5 5M9 15l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LegendIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6 7.5h12M6 12h12M6 16.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

function FilterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AttributesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 6.5h10M7 12h10M7 17.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4.5" cy="6.5" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CoreTasksIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M9 6.75h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 17.25h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m4.8 6.9 1.1 1.1 1.9-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.8 12.15 1.1 1.1 1.9-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.8 17.4 1.1 1.1 1.9-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewToggleIcon({ collapsed, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d={collapsed ? "M7 10.5 12 15.5 17 10.5" : "M7 13.5 12 8.5 17 13.5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OverviewToggleButton({ collapsed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!collapsed}
      className="inline-flex items-center gap-3 rounded-[20px] border border-white/12 bg-slate-950/55 px-3 py-2.5 text-left text-slate-100 shadow-[0_14px_34px_rgba(2,6,23,0.24)] transition hover:border-cyan-300/24 hover:bg-slate-950/72"
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${collapsed ? "border-cyan-300/18 bg-cyan-400/10 text-cyan-100" : "border-amber-300/18 bg-amber-400/10 text-amber-100"}`}>
        <OverviewToggleIcon collapsed={collapsed} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Overview</span>
        <span className="mt-0.5 block text-sm font-medium text-white">{collapsed ? "Expand details" : "Collapse details"}</span>
      </span>
    </button>
  );
}

function AttributesDrawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-950/54 p-3 backdrop-blur-sm md:p-5" onClick={onClose}>
      <div
        className="flex max-h-[82vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_28px_90px_rgba(2,6,23,0.48)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-3">
          <div className="h-1.5 w-16 rounded-full bg-white/12" />
        </div>
        <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))] px-4 pb-4 pt-3 md:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Attributes</div>
              <div className="mt-1 text-lg font-semibold text-white">{title}</div>
              <div className="mt-1 text-sm text-slate-300">{subtitle}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-0">{children}</div>
      </div>
    </div>
  );
}

function MapOverviewKpi({ label, value, detail, bars = [], tone = "cyan" }) {
  const toneClassName = {
    cyan: "border-cyan-300/16 bg-cyan-400/[0.05]",
    amber: "border-amber-300/16 bg-amber-400/[0.05]",
    emerald: "border-emerald-300/16 bg-emerald-400/[0.05]",
    rose: "border-rose-300/16 bg-rose-400/[0.05]",
  }[tone] || "border-white/10 bg-white/[0.04]";

  return (
    <div className={`rounded-[24px] border px-4 py-3 shadow-[0_18px_44px_rgba(2,6,23,0.22)] ${toneClassName}`}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{detail}</div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-black/20">
        {bars.length ? bars.map((bar, index) => (
          <span
            key={`${label}-${index}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max(0, Math.min(100, Number(bar.value) || 0))}%`, backgroundColor: bar.color }}
          />
        )) : <span className="h-full w-full bg-white/10" />}
      </div>
    </div>
  );
}

function AdvancedFilterPanel({
  projectScope,
  projectFilter,
  projectOptions,
  totalProjects,
  filters,
  activeFilterCount,
  descriptorOptions,
  holeStateOptions,
  holeCompletionStatusOptions,
  assetStatusOptions,
  assetTypeOptions,
  assetLocationOptions,
  onProjectScopeChange,
  onProjectFilterChange,
  onChange,
  onClear,
  onClose,
  containerClassName = "",
}) {
  return (
    <div className={[
      "mt-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.94))] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.36)] backdrop-blur-xl md:p-5",
      containerClassName,
    ].join(" ")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Detailed Filters</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Narrow the map by drilling type, hole progress, asset status, and mapped locations without leaving the workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200">
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.1]"
            onClick={onClear}
          >
            Clear all
          </button>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.1]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 xl:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Project Scope</div>
          <div className="mt-3 grid gap-3">
            <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/45 p-1.5 xl:w-auto">
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)]" : "text-slate-200 hover:bg-white/8"}`}
                onClick={() => onProjectScopeChange("own")}
              >
                My Projects
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.25)]" : "text-slate-200 hover:bg-white/8"}`}
                onClick={() => onProjectScopeChange("shared")}
              >
                Client Shared
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              Project Filter
              <select
                value={projectFilter}
                onChange={(event) => onProjectFilterChange(event.target.value)}
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
              >
                <option value="">All visible projects ({totalProjects})</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.holeCount} holes, {project.assetCount} assets)
                  </option>
                ))}
              </select>
            </label>

            {projectFilter ? (
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
                onClick={() => onProjectFilterChange("")}
              >
                Clear project
              </button>
            ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-cyan-300/14 bg-cyan-400/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">Drillholes</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FilterMultiSelect
              label="Drilling Type"
              values={filters.descriptorId}
              onChange={(value) => onChange("descriptorId", value)}
              emptyLabel="All drilling types"
              options={descriptorOptions.map((descriptor) => ({ value: descriptor.id, label: descriptor.name }))}
            />
            <FilterMultiSelect
              label="Hole Status"
              values={filters.holeState}
              onChange={(value) => onChange("holeState", value)}
              emptyLabel="All hole states"
              options={holeStateOptions}
            />
            <div className="md:col-span-2">
              <FilterMultiSelect
                label="Completion Status"
                values={filters.holeCompletionStatus}
                onChange={(value) => onChange("holeCompletionStatus", value)}
                emptyLabel="All completion statuses"
                options={holeCompletionStatusOptions}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-rose-300/14 bg-rose-400/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-rose-100/80">Assets</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FilterMultiSelect
              label="Asset Status"
              values={filters.assetStatus}
              onChange={(value) => onChange("assetStatus", value)}
              emptyLabel="All asset statuses"
              options={assetStatusOptions}
            />
            <FilterMultiSelect
              label="Asset Type"
              values={filters.assetTypeId}
              onChange={(value) => onChange("assetTypeId", value)}
              emptyLabel="All asset types"
              options={assetTypeOptions}
            />
            <div className="md:col-span-2">
              <FilterMultiSelect
                label="Location"
                values={filters.assetLocationId}
                onChange={(value) => onChange("assetLocationId", value)}
                emptyLabel="All locations"
                options={assetLocationOptions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedFilterDrawer({ open, onClose, children }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const animationFrame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }

    setVisible(false);
    const timeoutId = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[92] flex items-end backdrop-blur-sm transition-opacity duration-300 ease-out",
        visible ? "bg-slate-950/58 opacity-100" : "bg-slate-950/0 opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "w-full rounded-t-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_-24px_80px_rgba(2,6,23,0.48)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.18,0.9,0.22,1)]",
          "max-h-[88vh] overflow-hidden",
          visible ? "translate-y-0 opacity-100" : "translate-y-[18vh] opacity-0",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-advanced-filters-title"
      >
        <div className="mx-auto max-w-5xl overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 md:px-6">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
          {children}
        </div>
      </div>
    </div>
  );
}

function clearMapSelectionState({ setSelectedHoleId, setSelectedAssetId, popupRef, allowAutoSelectRef }) {
  allowAutoSelectRef.current = false;
  setSelectedHoleId("");
  setSelectedAssetId("");

  if (popupRef.current) {
    popupRef.current.remove();
    popupRef.current = null;
  }
}

function DockIconButton({ label, onClick, tone = "default", active = false, children }) {
  const toneClassName = {
    default: "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.11]",
    cyan: "border-cyan-300/18 bg-cyan-400/8 text-cyan-100 hover:bg-cyan-400/14",
    orange: "border-orange-300/22 bg-orange-400/10 text-orange-100 hover:bg-orange-400/16",
    emerald: "border-emerald-300/24 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16",
  }[tone] || "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.11]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition focus:outline-none focus:ring-2 focus:ring-cyan-300/35",
        toneClassName,
        active ? "shadow-[0_0_0_1px_rgba(250,204,21,0.22),0_10px_24px_rgba(2,6,23,0.26)]" : "shadow-[0_10px_24px_rgba(2,6,23,0.2)]",
      ].join(" ")}
    >
      {active ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-300" /> : null}
      <span className="h-[18px] w-[18px]">{children}</span>
    </button>
  );
}

function MapSelectionActionDock({
  entityType,
  entity,
  pendingProposal,
  mobile = false,
  onAdd,
  onMove,
  onDuplicate,
  onPropose,
  onReview,
  onOpenSchematic,
}) {
  const dockRef = useRef(null);
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const [dragging, setDragging] = useState(false);

  const clampPosition = useCallback((nextPosition) => {
    const dockElement = dockRef.current;
    const parentElement = dockElement?.parentElement;
    if (!dockElement || !parentElement) return nextPosition;

    const margin = 12;
    const maxX = Math.max(margin, parentElement.clientWidth - dockElement.offsetWidth - margin);
    const maxY = Math.max(margin, parentElement.clientHeight - dockElement.offsetHeight - margin);

    return {
      x: Math.min(Math.max(nextPosition.x, margin), maxX),
      y: Math.min(Math.max(nextPosition.y, margin), maxY),
    };
  }, []);

  const resetPosition = useCallback(() => {
    if (!entity?.id) return;

    requestAnimationFrame(() => {
      const dockElement = dockRef.current;
      const parentElement = dockElement?.parentElement;
      if (!dockElement || !parentElement) return;

      const margin = 12;
      const nextPosition = {
        x: parentElement.clientWidth - dockElement.offsetWidth - margin,
        y: margin,
      };

      setPosition(clampPosition(nextPosition));
      setPositionReady(true);
    });
  }, [clampPosition, entity?.id]);

  useEffect(() => {
    setPositionReady(false);
    setDragging(false);
    dragStateRef.current = null;
    resetPosition();
  }, [entity?.id, mobile, resetPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      if (!positionReady) {
        resetPosition();
        return;
      }
      setPosition((current) => clampPosition(current));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition, positionReady, resetPosition]);

  if (!entity) return null;

  const entityLabel = getMapEntityLabel(entityType, entity);
  const hasManageActions = Boolean(onAdd || onMove || onDuplicate || onPropose || onReview);
  const hasSchematicAction = entityType === "hole" && Boolean(onOpenSchematic);

  if (!hasManageActions && !hasSchematicAction) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={dockRef}
        className={[
          "pointer-events-auto absolute overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.9))] p-1.5 text-slate-100 shadow-[0_28px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl transition-shadow",
          dragging ? "shadow-[0_34px_70px_rgba(2,6,23,0.54)]" : "",
        ].join(" ")}
        style={{
          left: position.x,
          top: position.y,
          opacity: positionReady ? 1 : 0,
        }}
        aria-label={`${entityLabel} tools`}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Drag tools for ${entityLabel}`}
            title={`Drag tools for ${entityLabel}`}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              dragStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                origin: position,
              };
              setDragging(true);
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
              event.preventDefault();
              const deltaX = event.clientX - dragStateRef.current.startX;
              const deltaY = event.clientY - dragStateRef.current.startY;
              setPosition(clampPosition({
                x: dragStateRef.current.origin.x + deltaX,
                y: dragStateRef.current.origin.y + deltaY,
              }));
            }}
            onPointerUp={(event) => {
              if (dragStateRef.current?.pointerId !== event.pointerId) return;
              dragStateRef.current = null;
              setDragging(false);
              event.currentTarget.releasePointerCapture?.(event.pointerId);
            }}
            onPointerCancel={(event) => {
              if (dragStateRef.current?.pointerId !== event.pointerId) return;
              dragStateRef.current = null;
              setDragging(false);
              event.currentTarget.releasePointerCapture?.(event.pointerId);
            }}
            className="inline-flex h-10 w-10 cursor-grab items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-white/[0.1] active:cursor-grabbing"
          >
            <DockGripIcon className="h-[17px] w-[17px]" />
          </button>

          <div className="h-8 w-px bg-white/10" />

          {onAdd ? (
            <DockIconButton label="Add hole or asset on map" onClick={onAdd} tone="cyan">
              <span className="text-[20px] font-light leading-none">+</span>
            </DockIconButton>
          ) : null}

          {hasSchematicAction ? (
            <DockIconButton label="Open schematic" onClick={onOpenSchematic} tone="cyan">
              <DockSchematicIcon className="h-[18px] w-[18px]" />
            </DockIconButton>
          ) : null}

          {onMove ? (
            <DockIconButton label="Move selected item" onClick={onMove} tone="orange">
              <DockMoveIcon className="h-[18px] w-[18px]" />
            </DockIconButton>
          ) : null}

          {onDuplicate ? (
            <DockIconButton label="Duplicate selected item" onClick={onDuplicate} tone="cyan">
              <DockDuplicateIcon className="h-[18px] w-[18px]" />
            </DockIconButton>
          ) : null}

          {onPropose ? (
            <DockIconButton label={pendingProposal ? "Replace location proposal" : "Propose location"} onClick={onPropose} tone="default" active={Boolean(pendingProposal)}>
              <DockProposalIcon className="h-[18px] w-[18px]" />
            </DockIconButton>
          ) : null}

          {pendingProposal && onReview ? (
            <DockIconButton label="Review pending proposal" onClick={onReview} tone="emerald" active>
              <DockReviewIcon className="h-[18px] w-[18px]" />
            </DockIconButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MapEntityDuplicateModal({ selection, saving, onClose, onChangeName, onSubmit }) {
  useEffect(() => {
    if (!selection) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, saving, selection]);

  if (!selection) return null;

  return (
    <div className="fixed inset-0 z-[96] bg-slate-950/78 backdrop-blur-md" onClick={() => (!saving ? onClose() : null)}>
      <div className="flex h-full w-full items-end justify-center p-3 md:items-center md:p-6">
        <div className="glass w-full max-w-md rounded-[30px] border border-white/15 bg-slate-950/90 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.65)]" onClick={(event) => event.stopPropagation()}>
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Duplicate {selection.entityType === "hole" ? "Hole" : "Asset"}</div>
          <div className="mt-2 text-xl font-semibold text-white">Create a copy of {selection.sourceLabel}</div>
          <div className="mt-1 text-sm text-slate-300">Enter the new {selection.entityType === "hole" ? "hole ID" : "asset name"}. The duplicate will start at the same map location.</div>

          <label className="mt-5 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {selection.entityType === "hole" ? "New Hole ID" : "New Asset Name"}
            <input
              value={selection.newName}
              onChange={(event) => onChangeName(event.target.value)}
              className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
              placeholder={selection.entityType === "hole" ? "DDH-002" : "Pump 02"}
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" onClick={onSubmit} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0ea5e9)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Duplicating..." : "Create Duplicate"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapLocationProposalModal({ draft, saving, onClose, onChangeNote, onSubmit }) {
  useEffect(() => {
    if (!draft) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [draft, onClose, saving]);

  if (!draft) return null;

  return (
    <div className="fixed inset-0 z-[96] bg-slate-950/78 backdrop-blur-md" onClick={() => (!saving ? onClose() : null)}>
      <div className="flex h-full w-full items-end justify-center p-3 md:items-center md:p-6">
        <div className="glass w-full max-w-lg rounded-[30px] border border-white/15 bg-slate-950/90 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.65)]" onClick={(event) => event.stopPropagation()}>
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Propose New Location</div>
          <div className="mt-2 text-xl font-semibold text-white">{draft.label}</div>
          <div className="mt-1 text-sm text-slate-300">Submit a proposed location for review. This will not move the live point until it is approved.</div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatCoordinatePreview(draft.currentLongitude)}, {formatCoordinatePreview(draft.currentLatitude)}</div>
            </div>
            <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/8 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Proposed</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatCoordinatePreview(draft.proposedLongitude)}, {formatCoordinatePreview(draft.proposedLatitude)}</div>
            </div>
          </div>

          <label className="mt-5 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Note
            <textarea
              value={draft.note}
              onChange={(event) => onChangeNote(event.target.value)}
              className="min-h-28 rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
              placeholder="Why is this location being proposed?"
            />
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" onClick={onSubmit} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#0ea5e9)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : draft.proposalId ? "Update Proposal" : "Submit Proposal"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapLocationProposalReviewModal({ review, saving, onClose, onChangeReviewNote, onApprove, onReject }) {
  useEffect(() => {
    if (!review) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, review, saving]);

  if (!review) return null;

  const proposal = review.proposal;

  return (
    <div className="fixed inset-0 z-[96] bg-slate-950/78 backdrop-blur-md" onClick={() => (!saving ? onClose() : null)}>
      <div className="flex h-full w-full items-end justify-center p-3 md:items-center md:p-6">
        <div className="glass w-full max-w-lg rounded-[30px] border border-white/15 bg-slate-950/90 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.65)]" onClick={(event) => event.stopPropagation()}>
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Review Location Proposal</div>
          <div className="mt-2 text-xl font-semibold text-white">{review.label}</div>
          <div className="mt-1 text-sm text-slate-300">Approve to update the live map point, or reject to keep the existing coordinates.</div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Current</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatCoordinatePreview(review.currentLongitude)}, {formatCoordinatePreview(review.currentLatitude)}</div>
            </div>
            <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/8 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Proposed</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatCoordinatePreview(proposal.proposed_longitude)}, {formatCoordinatePreview(proposal.proposed_latitude)}</div>
            </div>
          </div>

          {proposal.note ? <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">{proposal.note}</div> : null}

          <label className="mt-5 flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Review Note
            <textarea
              value={review.reviewNote}
              onChange={(event) => onChangeReviewNote(event.target.value)}
              className="min-h-24 rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/40"
              placeholder="Optional note for the decision"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" onClick={onReject} disabled={saving} className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Reject"}</button>
            <button type="button" onClick={onApprove} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#34d399,#0f766e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(16,185,129,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Approve"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HoleMapWorkspace({ publicToken = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId, memberships, isAnonymousDemo } = useOrg();
  const requestedHoleId = searchParams.get("holeId") || "";
  const requestedProjectScope = searchParams.get("scope") || "";

  const mapCardRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxRef = useRef(null);
  const popupRef = useRef(null);
  const handlersBoundRef = useRef(false);
  const mapReadyRef = useRef(false);
  const fallbackStyleActiveRef = useRef(false);
  const visibleHolesRef = useRef([]);
  const visibleAssetsRef = useRef([]);
  const allowAutoSelectRef = useRef(false);
  const createPlacementActiveRef = useRef(false);
  const moveSelectionRef = useRef(null);
  const proposalPlacementSelectionRef = useRef(null);
  const createEntityTypeRef = useRef("hole");
  const pendingMapRestoreRef = useRef(null);
  const pendingHoleFocusRef = useRef("");
  const applyingMapRestoreRef = useRef(false);
  const preserveViewportAfterRefreshRef = useRef(false);

  const [projectScope, setProjectScope] = useState("own");
  const [loading, setLoading] = useState(true);
  const [mapStatus, setMapStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [mapNotice, setMapNotice] = useState("");
  const [allHoles, setAllHoles] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [locationProposals, setLocationProposals] = useState([]);
  const [ownProjects, setOwnProjects] = useState([]);
  const [holeWorkflows, setHoleWorkflows] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [assetLocations, setAssetLocations] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [assetNavigatorTypeFilter, setAssetNavigatorTypeFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(createEmptyMapAdvancedFilters);
  const [isOverviewStripCollapsed, setIsOverviewStripCollapsed] = useState(true);
  const [navigatorTab, setNavigatorTab] = useState("holes");
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedAssetProjects, setExpandedAssetProjects] = useState({});
  const [selectedHoleId, setSelectedHoleId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [mobilePanelTab, setMobilePanelTab] = useState("holes");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showAttributesDrawer, setShowAttributesDrawer] = useState(false);
  const [createPlacementActive, setCreatePlacementActive] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createEntityType, setCreateEntityType] = useState("hole");
  const [savingCreateEntity, setSavingCreateEntity] = useState(false);
  const [moveSelection, setMoveSelection] = useState(null);
  const [savingMoveSelection, setSavingMoveSelection] = useState(false);
  const [duplicateSelection, setDuplicateSelection] = useState(null);
  const [duplicatingEntity, setDuplicatingEntity] = useState(false);
  const [proposalPlacementSelection, setProposalPlacementSelection] = useState(null);
  const [proposalDraft, setProposalDraft] = useState(null);
  const [savingProposalDraft, setSavingProposalDraft] = useState(false);
  const [proposalReview, setProposalReview] = useState(null);
  const [savingProposalReview, setSavingProposalReview] = useState(false);
  const [savingAdminAction, setSavingAdminAction] = useState(false);
  const [deletingAdminAction, setDeletingAdminAction] = useState(false);
  const [holeDraft, setHoleDraft] = useState(createMapHoleDraft());
  const [assetDraft, setAssetDraft] = useState(createMapAssetDraft());
  const [editingHole, setEditingHole] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [schematicHole, setSchematicHole] = useState(null);
  const [schematicLoading, setSchematicLoading] = useState(false);
  const [schematicError, setSchematicError] = useState("");
  const [schematicGeologyRows, setSchematicGeologyRows] = useState([]);
  const [schematicConstructionRows, setSchematicConstructionRows] = useState([]);
  const [schematicAnnulusRows, setSchematicAnnulusRows] = useState([]);
  const [schematicLithologyTypes, setSchematicLithologyTypes] = useState([]);
  const [schematicConstructionTypes, setSchematicConstructionTypes] = useState([]);
  const [schematicAnnulusTypes, setSchematicAnnulusTypes] = useState([]);
  const [selectedHoleWorkflowRuntime, setSelectedHoleWorkflowRuntime] = useState({ loading: false, substageStatusById: {} });
  const [signingWorkflowPhaseId, setSigningWorkflowPhaseId] = useState("");
  const [signingWorkflowStepId, setSigningWorkflowStepId] = useState("");
  const [selectedWorkflowPhaseId, setSelectedWorkflowPhaseId] = useState("");

  const myRole = useMemo(() => {
    const membership = (memberships || []).find((item) => item.organization_id === orgId);
    return membership?.organization_role ?? membership?.role ?? null;
  }, [memberships, orgId]);

  const canManageSelections = projectScope !== "shared" && myRole === "admin";
  const canOpenDemoSchematic = isAnonymousDemo && projectScope !== "shared";

  useEffect(() => {
    createPlacementActiveRef.current = createPlacementActive;
  }, [createPlacementActive]);

  useEffect(() => {
    moveSelectionRef.current = moveSelection;
  }, [moveSelection]);

  useEffect(() => {
    proposalPlacementSelectionRef.current = proposalPlacementSelection;
  }, [proposalPlacementSelection]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleFullscreenChange = () => {
      const nextIsFullscreen = document.fullscreenElement === mapCardRef.current;
      setIsMapFullscreen(nextIsFullscreen);
      requestAnimationFrame(() => {
        mapRef.current?.resize();
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    createEntityTypeRef.current = createEntityType;
  }, [createEntityType]);

  const toggleMapFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;

    try {
      if (document.fullscreenElement === mapCardRef.current) {
        await document.exitFullscreen();
        return;
      }

      await mapCardRef.current?.requestFullscreen?.();
    } catch (error) {
      toast.error(error?.message || "Fullscreen mode is unavailable");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MAP_SCOPE_STORAGE_KEY);
    if (stored === "own" || stored === "shared") {
      setProjectScope(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(MAP_RETURN_STATE_STORAGE_KEY);
    if (!raw) return;

    window.sessionStorage.removeItem(MAP_RETURN_STATE_STORAGE_KEY);

    try {
      const snapshot = JSON.parse(raw);
      if (!snapshot || typeof snapshot !== "object") return;

      pendingMapRestoreRef.current = snapshot;

      if (snapshot.projectScope === "own" || snapshot.projectScope === "shared") {
        setProjectScope(snapshot.projectScope);
      }
      if (typeof snapshot.projectFilter === "string") {
        setProjectFilter(snapshot.projectFilter);
      }
      if (snapshot.advancedFilters) {
        setAdvancedFilters(normalizeMapAdvancedFilters(snapshot.advancedFilters));
      }
      if (snapshot.navigatorTab === "holes" || snapshot.navigatorTab === "assets") {
        setNavigatorTab(snapshot.navigatorTab);
      }
      if (["holes", "assets"].includes(snapshot.mobilePanelTab)) {
        setMobilePanelTab(snapshot.mobilePanelTab);
      }
      if (typeof snapshot.selectedHoleId === "string") {
        setSelectedHoleId(snapshot.selectedHoleId);
      }
      if (typeof snapshot.selectedAssetId === "string") {
        setSelectedAssetId(snapshot.selectedAssetId);
      }
    } catch {
      pendingMapRestoreRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!requestedHoleId) {
      pendingHoleFocusRef.current = "";
      return;
    }

    pendingHoleFocusRef.current = requestedHoleId;
    setNavigatorTab("holes");
    setMobilePanelTab("holes");
    setSelectedAssetId("");
    setProjectFilter("");
    setAdvancedFilters(createEmptyMapAdvancedFilters());
    setSelectedHoleId(requestedHoleId);

    if (requestedProjectScope === "own" || requestedProjectScope === "shared") {
      setProjectScope(requestedProjectScope);
    }
  }, [requestedHoleId, requestedProjectScope]);

  useEffect(() => {
    if (projectScope !== "own") {
      setShowCreatePanel(false);
      setMoveSelection(null);
      setDuplicateSelection(null);
      setProposalPlacementSelection(null);
      setProposalDraft(null);
      setProposalReview(null);
    }
  }, [projectScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_SCOPE_STORAGE_KEY, projectScope);
  }, [projectScope]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const syncViewport = (event) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!orgId) {
      setOwnProjects([]);
      setHoleWorkflows([]);
      setAssetTypes([]);
      setAssetLocations([]);
      return undefined;
    }

    let active = true;

    (async () => {
      const [projectsRes, typesRes, locationsRes, workflowsRes, phasesRes, substagesRes] = await Promise.all([
        supabase.from("projects").select("id,name,coordinate_crs_code,coordinate_crs_name").eq("organization_id", orgId).order("name", { ascending: true }),
        supabase.from("asset_types").select("id,name").order("name", { ascending: true }),
        supabase.from("asset_locations").select("id,name").eq("organization_id", orgId).order("name", { ascending: true }),
        supabase.from("workflow_definitions").select("id,organization_id,entity_type,key,name,description,color,sort_order,is_active").eq("organization_id", orgId).eq("entity_type", "hole").order("sort_order", { ascending: true }),
        supabase.from("workflow_phase_definitions").select("id,workflow_id,phase_index,name,description").order("phase_index", { ascending: true }),
        supabase.from("workflow_substage_definitions").select("id,workflow_phase_id,substage_index,name,description").order("substage_index", { ascending: true }),
      ]);

      if (!active) return;

      if (projectsRes.error) {
        toast.error(projectsRes.error.message || "Failed to load projects for map creation");
      } else {
        setOwnProjects(projectsRes.data || []);
      }

      if (workflowsRes.error) {
        toast.error(workflowsRes.error.message || "Failed to load hole workflows");
      } else if (!phasesRes.error && !substagesRes.error) {
        setHoleWorkflows(normalizeWorkflows(workflowsRes.data || [], phasesRes.data || [], substagesRes.data || []));
      }

      if (typesRes.error) {
        toast.error(typesRes.error.message || "Failed to load asset types");
      } else {
        setAssetTypes(typesRes.data || []);
      }

      if (locationsRes.error) {
        toast.error(locationsRes.error.message || "Failed to load asset locations");
      } else {
        setAssetLocations(locationsRes.data || []);
      }
    })();

    return () => {
      active = false;
    };
  }, [orgId, supabase]);

  useEffect(() => {
    const token = String(publicToken || "").trim();

    if (!token) {
      setMapStatus("error");
      setError("Missing NEXT_PUBLIC_MAPBOX_TOKEN in environment.");
      setMapNotice("");
      return undefined;
    }

    let disposed = false;

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (disposed || !mapContainerRef.current) return;

        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = token;

        const createMap = (styleUrl, { isFallback = false } = {}) => {
          let mapLoaded = false;
          const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            pitch: DEFAULT_PITCH,
            bearing: DEFAULT_BEARING,
            cooperativeGestures: true,
          });

          mapRef.current = map;
          map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

          map.on("load", () => {
            if (disposed) return;
            mapLoaded = true;
            mapReadyRef.current = true;
            fallbackStyleActiveRef.current = isFallback;
            setMapStatus("ready");
            setError("");
            setMapNotice(isFallback ? "Custom Mapbox style is unavailable locally. Showing the standard basemap instead." : "");
          });

          map.on("error", (evt) => {
            if (disposed) return;
            const message = evt?.error?.message || "Mapbox runtime error.";
            const shouldFallback = !isFallback && !fallbackStyleActiveRef.current && (!mapLoaded || /composite/i.test(message));

            if (shouldFallback) {
              fallbackStyleActiveRef.current = true;
              handlersBoundRef.current = false;
              mapReadyRef.current = false;
              if (popupRef.current) {
                popupRef.current.remove();
                popupRef.current = null;
              }
              try {
                map.remove();
              } catch {
                // Ignore teardown failures during style fallback.
              }
              if (mapRef.current === map) mapRef.current = null;
              setMapStatus("initializing");
              setError("");
              setMapNotice("Custom Mapbox style failed to load. Falling back to the standard basemap.");
              createMap(MAPBOX_FALLBACK_STYLE_URL, { isFallback: true });
              return;
            }

            setMapStatus("error");
            setError(message);
          });
        };

        fallbackStyleActiveRef.current = false;
        setMapNotice("");
        createMap(MAPBOX_STYLE_URL);
      } catch (evt) {
        if (disposed) return;
        setMapStatus("error");
        setError(evt?.message || "Failed to initialize Mapbox.");
        setMapNotice("");
      }
    };

    void initMap();

    return () => {
      disposed = true;
      handlersBoundRef.current = false;
      mapReadyRef.current = false;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [publicToken]);

  const loadData = useCallback(async () => {
    if (!orgId) {
      setAllHoles([]);
      setAllAssets([]);
      setLocationProposals([]);
      setLoading(false);
      return { holes: [], assets: [] };
    }

    setLoading(true);
    setError("");

    try {
      let holeRows = [];
      let assetRows = [];
      let proposalRows = [];

      if (projectScope === "shared") {
        const { data: sharedRows, error: sharedErr } = await supabase
          .from("organization_shared_projects")
          .select("project_id, relationship:relationship_id(vendor_organization_id,status,permissions,accepted_at)")
          .limit(5000);

        if (sharedErr) throw sharedErr;

        const sharedProjectIds = Array.from(
          new Set(
            (sharedRows || [])
              .filter((row) => {
                const rel = row.relationship;
                if (!rel) return false;
                const status = String(rel.status || "");
                const accepted = status === "active" || status === "accepted" || !!rel.accepted_at;
                const allowed = !!rel.permissions?.share_project_details;
                return rel.vendor_organization_id === orgId && accepted && allowed;
              })
              .map((row) => row.project_id)
              .filter(Boolean)
          )
        );

        if (sharedProjectIds.length) {
          const [holesRes, assetsRes] = await Promise.all([
            supabase
              .from("holes")
              .select(
                "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,current_workflow_id,current_workflow_phase_id,current_workflow_substage_id,current_workflow_status_key,projects(id,name,coordinate_crs_code,coordinate_crs_name)"
              )
              .in("project_id", sharedProjectIds)
              .neq("organization_id", orgId)
              .order("project_id", { ascending: true })
              .order("hole_id", { ascending: true }),
            supabase
              .from("assets")
              .select(
                "id,organization_id,name,asset_type_id,location_id,project_id,status,easting,northing,longitude,latitude,coordinate_source,asset_types(name),asset_locations(name),projects(id,name,coordinate_crs_code,coordinate_crs_name)"
              )
              .in("project_id", sharedProjectIds)
              .neq("organization_id", orgId)
              .order("project_id", { ascending: true })
              .order("name", { ascending: true }),
          ]);

          if (holesRes.error) throw holesRes.error;
          if (assetsRes.error) throw assetsRes.error;
          holeRows = holesRes.data || [];
          assetRows = assetsRes.data || [];
        }
      } else {
        const [holesRes, assetsRes] = await Promise.all([
          supabase
            .from("holes")
            .select(
              "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,current_workflow_id,current_workflow_phase_id,current_workflow_substage_id,current_workflow_status_key,projects(id,name,coordinate_crs_code,coordinate_crs_name)"
            )
            .eq("organization_id", orgId)
            .order("project_id", { ascending: true })
            .order("hole_id", { ascending: true }),
          supabase
            .from("assets")
            .select(
              "id,organization_id,name,asset_type_id,location_id,project_id,status,easting,northing,longitude,latitude,coordinate_source,asset_types(name),asset_locations(name),projects(id,name,coordinate_crs_code,coordinate_crs_name)"
            )
            .eq("organization_id", orgId)
            .order("project_id", { ascending: true })
            .order("name", { ascending: true }),
        ]);

        if (holesRes.error) throw holesRes.error;
        if (assetsRes.error) throw assetsRes.error;
        holeRows = holesRes.data || [];
        assetRows = assetsRes.data || [];
      }

      const mappedHoles = holeRows
        .map((hole) => {
          const derived = deriveHoleCoordinates({
            collarLongitude: hole.collar_longitude ?? null,
            collarLatitude: hole.collar_latitude ?? null,
            collarEasting: hole.collar_easting ?? null,
            collarNorthing: hole.collar_northing ?? null,
            projectCrsCode: hole.projects?.coordinate_crs_code ?? null,
          });

          return {
            id: hole.id,
            organization_id: hole.organization_id,
            hole_id: hole.hole_id,
            project_id: hole.project_id || "",
            project_name: hole.projects?.name || "No project",
            current_workflow_id: hole.current_workflow_id || "",
            current_workflow_phase_id: hole.current_workflow_phase_id || "",
            current_workflow_substage_id: hole.current_workflow_substage_id || "",
            current_workflow_status_key: hole.current_workflow_status_key || "not_started",
            state: hole.state || "",
            depth: hole.depth ?? null,
            planned_depth: hole.planned_depth ?? null,
            water_level_m: hole.water_level_m ?? null,
            azimuth: hole.azimuth ?? null,
            dip: hole.dip ?? null,
            collar_longitude: derived.collarLongitude,
            collar_latitude: derived.collarLatitude,
            collar_easting: hole.collar_easting ?? null,
            collar_northing: hole.collar_northing ?? null,
            collar_elevation_m: hole.collar_elevation_m ?? null,
            collar_source: hole.collar_source ?? null,
            started_at: hole.started_at ?? null,
            completed_at: hole.completed_at ?? null,
            completion_status: hole.completion_status ?? null,
            completion_notes: hole.completion_notes ?? null,
          };
        })
        .filter((hole) => hole.collar_longitude != null && hole.collar_latitude != null);

      const descriptorsByHole = await fetchHoleDescriptorAssignments(
        supabase,
        mappedHoles.map((hole) => hole.id)
      );

      const nextHoles = attachHoleDescriptors(mappedHoles, descriptorsByHole);
      const nextAssets = assetRows
        .map((asset) => {
          const baseAsset = {
            id: asset.id,
            organization_id: asset.organization_id,
            name: asset.name || "Unnamed asset",
            asset_type_id: asset.asset_type_id || "",
            location_id: asset.location_id || "",
            project_id: asset.project_id || "",
            project_name: asset.projects?.name || "No project",
            project_crs_code: asset.projects?.coordinate_crs_code || null,
            project_crs_name: asset.projects?.coordinate_crs_name || null,
            status: asset.status || "",
            asset_type_name: asset.asset_types?.name || "",
            location_name: asset.asset_locations?.name || "",
            easting: asset.easting ?? null,
            northing: asset.northing ?? null,
            longitude: asset.longitude ?? null,
            latitude: asset.latitude ?? null,
            coordinate_source: asset.coordinate_source ?? null,
          };

          const derived = deriveMapAssetCoordinates(baseAsset);
          return {
            ...baseAsset,
            longitude: derived.longitude,
            latitude: derived.latitude,
            coordinate_derived: derived.coordinateDerived,
          };
        })
        .filter((asset) => asset.longitude != null && asset.latitude != null);

      if (projectScope === "own") {
        const { data: proposalsRes, error: proposalsError } = await supabase
          .from("map_location_proposals")
          .select("id,organization_id,project_id,entity_type,entity_id,proposed_longitude,proposed_latitude,note,status,created_by,created_at,updated_at,reviewed_by,reviewed_at,review_note")
          .eq("organization_id", orgId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (proposalsError) throw proposalsError;
        proposalRows = proposalsRes || [];
      }

      setAllHoles(nextHoles);
      setAllAssets(nextAssets);
      setLocationProposals(proposalRows);
      return { holes: nextHoles, assets: nextAssets, proposals: proposalRows };
    } catch (evt) {
      const message = evt?.message || "Failed to load map holes";
      setAllHoles([]);
      setAllAssets([]);
      setLocationProposals([]);
      setError(message);
      toast.error(message);
      return { holes: [], assets: [], proposals: [] };
    } finally {
      setLoading(false);
    }
  }, [orgId, projectScope, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const projects = useMemo(() => {
    const projectMap = new Map();
    (allHoles || []).forEach((hole) => {
      const key = hole.project_id || "unassigned";
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          id: key,
          name: hole.project_name || "No project",
          holes: [],
        });
      }
      projectMap.get(key).holes.push(hole);
    });

    return Array.from(projectMap.values())
      .map((project) => ({
        ...project,
        holes: project.holes.slice().sort((a, b) => String(a.hole_id || "").localeCompare(String(b.hole_id || ""))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allHoles]);

  const descriptorOptions = useMemo(() => {
    const descriptorMap = new Map();
    (allHoles || []).forEach((hole) => {
      (hole.descriptors || []).forEach((descriptor) => {
        if (!descriptorMap.has(descriptor.id)) descriptorMap.set(descriptor.id, descriptor);
      });
    });
    return Array.from(descriptorMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [allHoles]);

  const holeStateOptions = useMemo(() => {
    const preferredOrder = new Map(HOLE_STATE_STYLES.map((item, index) => [item.value, index]));
    const values = Array.from(new Set((allHoles || []).map((hole) => String(hole.state || "").trim()).filter(Boolean)));
    return values
      .map((value) => ({ value, label: formatFilterOptionLabel(value) }))
      .sort((left, right) => {
        const leftOrder = preferredOrder.has(left.value) ? preferredOrder.get(left.value) : Number.MAX_SAFE_INTEGER;
        const rightOrder = preferredOrder.has(right.value) ? preferredOrder.get(right.value) : Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.label.localeCompare(right.label);
      });
  }, [allHoles]);

  const holeCompletionStatusOptions = useMemo(() => {
    return Array.from(new Set((allHoles || []).map((hole) => String(hole.completion_status || "").trim()).filter(Boolean)))
      .map((value) => ({ value, label: value }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [allHoles]);

  const assetStatusOptions = useMemo(() => {
    return Array.from(new Set((allAssets || []).map((asset) => String(asset.status || "").trim()).filter(Boolean)))
      .map((value) => ({ value, label: value }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [allAssets]);

  const assetTypeOptions = useMemo(() => {
    const optionMap = new Map();
    (allAssets || []).forEach((asset) => {
      if (!asset.asset_type_id || !asset.asset_type_name) return;
      if (!optionMap.has(asset.asset_type_id)) {
        optionMap.set(asset.asset_type_id, { value: asset.asset_type_id, label: asset.asset_type_name });
      }
    });
    return Array.from(optionMap.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [allAssets]);

  const assetLocationOptions = useMemo(() => {
    const optionMap = new Map();
    (allAssets || []).forEach((asset) => {
      if (!asset.location_id || !asset.location_name) return;
      if (!optionMap.has(asset.location_id)) {
        optionMap.set(asset.location_id, { value: asset.location_id, label: asset.location_name });
      }
    });
    return Array.from(optionMap.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [allAssets]);

  const matchesHoleAdvancedFilters = useCallback((hole) => {
    if (advancedFilters.descriptorId.length && !advancedFilters.descriptorId.some((value) => (hole.descriptor_ids || []).includes(value))) return false;
    if (advancedFilters.holeState.length && !advancedFilters.holeState.includes(String(hole.state || ""))) return false;
    if (advancedFilters.holeCompletionStatus.length && !advancedFilters.holeCompletionStatus.includes(String(hole.completion_status || ""))) return false;
    return true;
  }, [advancedFilters]);

  const matchesAssetAdvancedFilters = useCallback((asset) => {
    if (advancedFilters.assetStatus.length && !advancedFilters.assetStatus.includes(String(asset.status || ""))) return false;
    if (advancedFilters.assetTypeId.length && !advancedFilters.assetTypeId.includes(String(asset.asset_type_id || ""))) return false;
    if (advancedFilters.assetLocationId.length && !advancedFilters.assetLocationId.includes(String(asset.location_id || ""))) return false;
    return true;
  }, [advancedFilters]);

  const matchesAssetNavigatorTypeFilter = useCallback((asset) => {
    if (!assetNavigatorTypeFilter) return true;
    return String(asset.asset_type_id || "") === assetNavigatorTypeFilter;
  }, [assetNavigatorTypeFilter]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => !projectFilter || project.id === projectFilter)
      .map((project) => ({
        ...project,
        holes: project.holes.filter(matchesHoleAdvancedFilters),
      }))
      .filter((project) => project.holes.length > 0);
  }, [matchesHoleAdvancedFilters, projectFilter, projects]);

  const assetProjects = useMemo(() => {
    const projectMap = new Map();
    (allAssets || []).forEach((asset) => {
      const key = asset.project_id || "unassigned";
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          id: key,
          name: asset.project_name || "No project",
          assets: [],
        });
      }
      projectMap.get(key).assets.push(asset);
    });

    return Array.from(projectMap.values())
      .map((project) => ({
        ...project,
        assets: project.assets.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAssets]);

  const projectOptions = useMemo(() => {
    const optionMap = new Map();

    projects.forEach((project) => {
      optionMap.set(project.id, {
        id: project.id,
        name: project.name,
        holeCount: project.holes.length,
        assetCount: 0,
      });
    });

    assetProjects.forEach((project) => {
      if (!optionMap.has(project.id)) {
        optionMap.set(project.id, {
          id: project.id,
          name: project.name,
          holeCount: 0,
          assetCount: project.assets.length,
        });
      } else {
        optionMap.get(project.id).assetCount = project.assets.length;
      }
    });

    return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assetProjects, projects]);

  const filteredAssetProjects = useMemo(() => {
    const scopedProjects = projectFilter ? assetProjects.filter((project) => project.id === projectFilter) : assetProjects;
    return scopedProjects
      .map((project) => ({
        ...project,
        assets: project.assets.filter((asset) => matchesAssetAdvancedFilters(asset) && matchesAssetNavigatorTypeFilter(asset)),
      }))
      .filter((project) => project.assets.length > 0);
  }, [assetProjects, matchesAssetAdvancedFilters, matchesAssetNavigatorTypeFilter, projectFilter]);

  const activeAdvancedFilterCount = useMemo(
    () => countActiveMapAdvancedFilters(advancedFilters) + (projectFilter ? 1 : 0),
    [advancedFilters, projectFilter]
  );

  const visibleHoles = useMemo(() => {
    return filteredProjects.flatMap((project) => project.holes);
  }, [filteredProjects]);

  const visibleAssets = useMemo(() => {
    return filteredAssetProjects.flatMap((project) => project.assets);
  }, [filteredAssetProjects]);

  const activeAssetNavigatorTypeLabel = useMemo(() => {
    return assetTypeOptions.find((option) => option.value === assetNavigatorTypeFilter)?.label || "";
  }, [assetNavigatorTypeFilter, assetTypeOptions]);

  useEffect(() => {
    visibleHolesRef.current = visibleHoles;
  }, [visibleHoles]);

  useEffect(() => {
    visibleAssetsRef.current = visibleAssets;
  }, [visibleAssets]);

  const selectedHole = useMemo(() => {
    return visibleHoles.find((hole) => hole.id === selectedHoleId) || (allowAutoSelectRef.current ? visibleHoles[0] || null : null);
  }, [selectedHoleId, visibleHoles]);

  const selectedAsset = useMemo(() => {
    return visibleAssets.find((asset) => asset.id === selectedAssetId) || (allowAutoSelectRef.current ? visibleAssets[0] || null : null);
  }, [selectedAssetId, visibleAssets]);

  const selectedHoleWorkflowDefinition = useMemo(
    () => holeWorkflows.find((workflow) => workflow.id === selectedHole?.current_workflow_id) || null,
    [holeWorkflows, selectedHole?.current_workflow_id]
  );

  const selectedHoleWorkflowVisual = useMemo(
    () => buildMapHoleWorkflowVisualModel({
      workflow: selectedHoleWorkflowDefinition,
      hole: selectedHole,
      substageStatusById: selectedHoleWorkflowRuntime.substageStatusById,
    }),
    [selectedHoleWorkflowDefinition, selectedHole, selectedHoleWorkflowRuntime.substageStatusById]
  );

  const loadSelectedHoleWorkflowRuntime = useCallback(async (holeId) => {
    if (!holeId) {
      setSelectedHoleWorkflowRuntime({ loading: false, substageStatusById: {} });
      return;
    }

    setSelectedHoleWorkflowRuntime((current) => ({ ...current, loading: true }));

    try {
      const { data, error } = await supabase
        .from("hole_workflow_substage_statuses")
        .select("hole_id,workflow_phase_id,workflow_substage_id,status_key,signed_off_by,signed_off_at,signoff_note,updated_at")
        .eq("hole_id", holeId);

      if (error) throw error;

      setSelectedHoleWorkflowRuntime({
        loading: false,
        substageStatusById: Object.fromEntries((data || []).map((row) => [row.workflow_substage_id, row])),
      });
    } catch (error) {
      toast.error(error?.message || "Failed to load hole workflow runtime");
      setSelectedHoleWorkflowRuntime({ loading: false, substageStatusById: {} });
    }
  }, [supabase]);

  useEffect(() => {
    if (!selectedHole?.id || !selectedHole?.current_workflow_id) {
      setSelectedHoleWorkflowRuntime({ loading: false, substageStatusById: {} });
      return;
    }

    void loadSelectedHoleWorkflowRuntime(selectedHole.id);
  }, [loadSelectedHoleWorkflowRuntime, selectedHole?.current_workflow_id, selectedHole?.id]);

  useEffect(() => {
    if (!selectedWorkflowPhaseId) return;
    if (!selectedHoleWorkflowVisual?.phases?.some((phase) => phase.id === selectedWorkflowPhaseId)) {
      setSelectedWorkflowPhaseId("");
    }
  }, [selectedHoleWorkflowVisual, selectedWorkflowPhaseId]);

  const toggleMapWorkflowStep = useCallback(async (phase, step) => {
    if (!canManageSelections || !selectedHole || !selectedHoleWorkflowVisual) return;

    const actionState = getMapWorkflowStepActionState({ workflowVisual: selectedHoleWorkflowVisual, phase, step, canManageSelections });
    const isReverting = actionState.actionType === "revert";
    if (!actionState.canToggle) return false;

    setSigningWorkflowPhaseId(phase.id);
    setSigningWorkflowStepId(step.id);

    try {
      const userResult = await supabase.auth.getUser();
      if (userResult.error) throw userResult.error;

      const userId = userResult.data?.user?.id || "";
      if (!userId) throw new Error("You must be signed in to sign off a workflow step");

      const signedOffAt = new Date().toISOString();
      const nextSelection = isReverting
        ? {
            phaseId: step.phaseId,
            substageId: step.stepId,
            statusKey: "planned",
          }
        : getNextMapWorkflowSelection(selectedHoleWorkflowVisual, step.id);

      const { error: signoffError } = await supabase.from("hole_workflow_substage_statuses").upsert(
        {
          hole_id: selectedHole.id,
          workflow_id: selectedHoleWorkflowVisual.workflowId,
          workflow_phase_id: step.phaseId,
          workflow_substage_id: step.stepId,
          status_key: isReverting ? "planned" : "complete",
          signed_off_by: isReverting ? null : userId,
          signed_off_at: isReverting ? null : signedOffAt,
          signoff_note: isReverting ? null : "Signed off from map workflow stage gate.",
        },
        { onConflict: "hole_id,workflow_substage_id" }
      );

      if (signoffError) throw signoffError;

      const { error: holeUpdateError } = await supabase
        .from("holes")
        .update({
          current_workflow_id: selectedHoleWorkflowVisual.workflowId,
          current_workflow_phase_id: nextSelection.phaseId || null,
          current_workflow_substage_id: nextSelection.substageId || null,
          current_workflow_status_key: nextSelection.statusKey,
        })
        .eq("id", selectedHole.id)
        .eq("organization_id", orgId);

      if (holeUpdateError) throw holeUpdateError;

      setSelectedHoleWorkflowRuntime((current) => ({
        ...current,
        substageStatusById: {
          ...current.substageStatusById,
          [step.stepId]: {
            ...(current.substageStatusById[step.stepId] || {}),
            hole_id: selectedHole.id,
            workflow_phase_id: step.phaseId,
            workflow_substage_id: step.stepId,
            status_key: isReverting ? "planned" : "complete",
            signed_off_by: isReverting ? null : userId,
            signed_off_at: isReverting ? null : signedOffAt,
            signoff_note: isReverting ? null : "Signed off from map workflow stage gate.",
            updated_at: signedOffAt,
          },
        },
      }));

      setAllHoles((current) =>
        current.map((hole) =>
          hole.id === selectedHole.id
            ? {
                ...hole,
                current_workflow_id: selectedHoleWorkflowVisual.workflowId,
                current_workflow_phase_id: nextSelection.phaseId || null,
                current_workflow_substage_id: nextSelection.substageId || null,
                current_workflow_status_key: nextSelection.statusKey,
              }
            : hole
        )
      );

      void loadSelectedHoleWorkflowRuntime(selectedHole.id);
      toast.success(isReverting ? `${step.title} reverted` : `${step.title} signed off`);
      return true;
    } catch (error) {
      toast.error(error?.message || `Failed to ${isReverting ? "revert" : "sign off"} workflow step`);
      return false;
    } finally {
      setSigningWorkflowPhaseId("");
      setSigningWorkflowStepId("");
    }
  }, [canManageSelections, loadSelectedHoleWorkflowRuntime, orgId, selectedHole, selectedHoleWorkflowVisual, supabase]);

  const selectedWorkflowPhase = useMemo(
    () => selectedHoleWorkflowVisual?.phases?.find((phase) => phase.id === selectedWorkflowPhaseId) || null,
    [selectedHoleWorkflowVisual, selectedWorkflowPhaseId]
  );

  const handleStageGateSelect = useCallback((phase) => {
    setSelectedWorkflowPhaseId(phase?.id || "");
  }, []);

  const handleWorkflowStepToggle = useCallback(async (phase, step) => {
    await toggleMapWorkflowStep(phase, step);
  }, [toggleMapWorkflowStep]);

  const pendingProposalByEntity = useMemo(() => {
    const next = new Map();
    (locationProposals || []).forEach((proposal) => {
      if (proposal.status !== "pending") return;
      next.set(getMapProposalEntityKey(proposal.entity_type, proposal.entity_id), proposal);
    });
    return next;
  }, [locationProposals]);

  const activeMapSelection = useMemo(() => {
    if (navigatorTab === "assets" && selectedAssetId && selectedAsset) {
      return { entityType: "asset", entity: selectedAsset };
    }
    if (selectedHoleId && selectedHole) {
      return { entityType: "hole", entity: selectedHole };
    }
    if (selectedAssetId && selectedAsset) {
      return { entityType: "asset", entity: selectedAsset };
    }
    return null;
  }, [navigatorTab, selectedAsset, selectedAssetId, selectedHole, selectedHoleId]);

  const activeMapSelectionPendingProposal = useMemo(() => {
    if (!activeMapSelection?.entity?.id) return null;
    return pendingProposalByEntity.get(getMapProposalEntityKey(activeMapSelection.entityType, activeMapSelection.entity.id)) || null;
  }, [activeMapSelection, pendingProposalByEntity]);

  const openHoleEditor = () => {
    if (!selectedHole || !canManageSelections) return;
    setEditingHole(selectedHole);
  };

  const openAssetEditor = () => {
    if (!selectedAsset || !canManageSelections) return;
    setEditingAsset(selectedAsset);
  };

  const closeHoleEditor = () => {
    if (savingAdminAction) return;
    setEditingHole(null);
  };

  const closeAssetEditor = () => {
    if (savingAdminAction) return;
    setEditingAsset(null);
  };

  const cancelMoveSelection = useCallback(() => {
    if (savingMoveSelection) return;
    setMoveSelection(null);
  }, [savingMoveSelection]);

  const cancelProposalPlacementSelection = useCallback(() => {
    if (savingProposalDraft) return;
    setProposalPlacementSelection(null);
  }, [savingProposalDraft]);

  const requestMoveSelection = useCallback((entityType, entity) => {
    if (!canManageSelections || !entity?.id) return;
    const label = getMapEntityLabel(entityType, entity);
    if (typeof window !== "undefined" && !window.confirm(`Are you sure you want to move the point for ${label}?`)) return;

    setDuplicateSelection(null);
    setProposalDraft(null);
    setShowCreatePanel(false);
    setCreatePlacementActive(false);
    setMoveSelection({
      entityType,
      entityId: entity.id,
      label,
    });

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    toast(`Click a free point on the map to move ${label}.`);
  }, [canManageSelections]);

  const requestProposalLocation = useCallback((entityType, entity) => {
    if (!canManageSelections || !entity?.id) return;

    const label = getMapEntityLabel(entityType, entity);
    const pendingProposal = pendingProposalByEntity.get(getMapProposalEntityKey(entityType, entity.id)) || null;

    setMoveSelection(null);
    setShowCreatePanel(false);
    setCreatePlacementActive(false);
    setProposalDraft(null);
    setProposalPlacementSelection({
      entityType,
      entityId: entity.id,
      label,
      entity,
      proposalId: pendingProposal?.id || null,
      note: pendingProposal?.note || "",
    });

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    toast(`Click a free point on the map to propose a new location for ${label}.`);
  }, [canManageSelections, pendingProposalByEntity]);

  const openDuplicateSelection = useCallback((entityType, entity) => {
    if (!canManageSelections || !entity?.id) return;

    setDuplicateSelection({
      entityType,
      entity,
      sourceLabel: getMapEntityLabel(entityType, entity),
      newName: "",
    });
  }, [canManageSelections]);

  const openProposalReview = useCallback((entityType, entity) => {
    if (!canManageSelections || !entity?.id) return;

    const proposal = pendingProposalByEntity.get(getMapProposalEntityKey(entityType, entity.id)) || null;
    if (!proposal) {
      toast.error("No pending proposal found");
      return;
    }

    const currentLongitude = entityType === "hole" ? entity.collar_longitude : entity.longitude;
    const currentLatitude = entityType === "hole" ? entity.collar_latitude : entity.latitude;

    setProposalReview({
      proposal,
      entityType,
      entityId: entity.id,
      label: getMapEntityLabel(entityType, entity),
      currentLongitude,
      currentLatitude,
      reviewNote: proposal.review_note || "",
    });
  }, [canManageSelections, pendingProposalByEntity]);

  useEffect(() => {
    if (!moveSelection) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        cancelMoveSelection();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cancelMoveSelection, moveSelection]);

  useEffect(() => {
    if (!proposalPlacementSelection) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        cancelProposalPlacementSelection();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cancelProposalPlacementSelection, proposalPlacementSelection]);

  const submitDuplicateSelection = async () => {
    if (!duplicateSelection?.entity || duplicatingEntity) return;

    const nextName = String(duplicateSelection.newName || "").trim();
    if (!nextName) {
      toast.error(`Enter a new ${duplicateSelection.entityType === "hole" ? "hole ID" : "asset name"}`);
      return;
    }

    setDuplicatingEntity(true);
    try {
      if (duplicateSelection.entityType === "hole") {
        const sourceHole = duplicateSelection.entity;
        const { data: insertedHole, error: insertError } = await supabase
          .from("holes")
          .insert({
            organization_id: orgId,
            project_id: sourceHole.project_id,
            hole_id: nextName,
            state: "proposed",
            planned_depth: sourceHole.planned_depth,
            water_level_m: sourceHole.water_level_m,
            azimuth: sourceHole.azimuth,
            dip: sourceHole.dip,
            collar_longitude: sourceHole.collar_longitude,
            collar_latitude: sourceHole.collar_latitude,
            collar_source: normalizeHoleCollarSource(sourceHole.collar_source),
          })
          .select("id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state")
          .single();

        if (insertError) throw insertError;

        if (sourceHole.descriptor_ids?.length) {
          await replaceHoleDescriptorAssignments(supabase, {
            orgId,
            holeId: insertedHole.id,
            descriptorIds: sourceHole.descriptor_ids,
          });
        }

        markViewportForPreserve(preserveViewportAfterRefreshRef);
        const { holes: freshHoles } = await loadData();
        const duplicatedHole = freshHoles.find((hole) => hole.id === insertedHole.id) || null;
        setDuplicateSelection(null);
        if (duplicatedHole) focusHole(duplicatedHole);
        toast.success("Hole duplicated");
        return;
      }

      const sourceAsset = duplicateSelection.entity;
      const selectedAssetType = assetTypes.find((type) => type.id === sourceAsset.asset_type_id) || null;
      if (!selectedAssetType) throw new Error("Asset type is missing for this asset");

      const { data: insertedAsset, error: insertError } = await supabase
        .from("assets")
        .insert({
          organization_id: orgId,
          name: nextName,
          asset_type: selectedAssetType.name,
          asset_type_id: selectedAssetType.id,
          location_id: sourceAsset.location_id || null,
          project_id: sourceAsset.project_id,
          longitude: sourceAsset.longitude,
          latitude: sourceAsset.latitude,
          coordinate_source: "duplicated_from_map",
          status: sourceAsset.status || "Active",
        })
        .select("id,organization_id,name,project_id,status,easting,northing,longitude,latitude,coordinate_source")
        .single();

      if (insertError) throw insertError;

      markViewportForPreserve(preserveViewportAfterRefreshRef);
      const { assets: freshAssets } = await loadData();
      const duplicatedAsset = freshAssets.find((asset) => asset.id === insertedAsset.id) || null;
      setDuplicateSelection(null);
      if (duplicatedAsset) focusAsset(duplicatedAsset);
      toast.success("Asset duplicated");
    } catch (error) {
      toast.error(error?.message || "Failed to duplicate entity");
    } finally {
      setDuplicatingEntity(false);
    }
  };

  const submitProposalDraft = async () => {
    if (!proposalDraft || savingProposalDraft) return;

    setSavingProposalDraft(true);
    try {
      const payload = {
        organization_id: orgId,
        entity_type: proposalDraft.entityType,
        entity_id: proposalDraft.entityId,
        proposed_longitude: Number(proposalDraft.proposedLongitude),
        proposed_latitude: Number(proposalDraft.proposedLatitude),
        note: toTextOrNull(proposalDraft.note),
        status: "pending",
      };

      if (proposalDraft.proposalId) {
        const { error: updateError } = await supabase
          .from("map_location_proposals")
          .update(payload)
          .eq("id", proposalDraft.proposalId)
          .eq("organization_id", orgId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("map_location_proposals").insert(payload);
        if (insertError) throw insertError;
      }

      const entityType = proposalDraft.entityType;
      const entityId = proposalDraft.entityId;
      markViewportForPreserve(preserveViewportAfterRefreshRef);
      const { holes: freshHoles, assets: freshAssets } = await loadData();
      setProposalDraft(null);

      if (entityType === "hole") {
        const refreshedHole = freshHoles.find((hole) => hole.id === entityId) || null;
        if (refreshedHole) focusHole(refreshedHole, { flyTo: false });
      } else {
        const refreshedAsset = freshAssets.find((asset) => asset.id === entityId) || null;
        if (refreshedAsset) focusAsset(refreshedAsset, { flyTo: false });
      }

      toast.success(proposalDraft.proposalId ? "Location proposal updated" : "Location proposal submitted");
    } catch (error) {
      toast.error(error?.message || "Failed to save location proposal");
    } finally {
      setSavingProposalDraft(false);
    }
  };

  const submitProposalReview = async (decision) => {
    if (!proposalReview?.proposal?.id || savingProposalReview) return;

    setSavingProposalReview(true);
    try {
      const { error: reviewError } = await supabase.rpc("review_map_location_proposal", {
        p_proposal_id: proposalReview.proposal.id,
        p_decision: decision,
        p_review_note: toTextOrNull(proposalReview.reviewNote),
      });

      if (reviewError) throw reviewError;

      const entityType = proposalReview.entityType;
      const entityId = proposalReview.entityId;
      markViewportForPreserve(preserveViewportAfterRefreshRef);
      const { holes: freshHoles, assets: freshAssets } = await loadData();
      setProposalReview(null);

      if (entityType === "hole") {
        const refreshedHole = freshHoles.find((hole) => hole.id === entityId) || null;
        if (refreshedHole) focusHole(refreshedHole, { flyTo: false });
      } else {
        const refreshedAsset = freshAssets.find((asset) => asset.id === entityId) || null;
        if (refreshedAsset) focusAsset(refreshedAsset, { flyTo: false });
      }

      toast.success(decision === "approved" ? "Location proposal approved" : "Location proposal rejected");
    } catch (error) {
      toast.error(error?.message || "Failed to review location proposal");
    } finally {
      setSavingProposalReview(false);
    }
  };

  const saveHoleEdits = async (form) => {
    if (!editingHole || !canManageSelections) return;

    const holeId = String(form.hole_id || "").trim();
    const longitude = toNullableNumber(form.collar_longitude);
    const latitude = toNullableNumber(form.collar_latitude);
    const azimuth = toNullableNumber(form.azimuth);
    const dip = toNullableNumber(form.dip);

    if (!form.project_id) return toast.error("Select a project");
    if (!holeId) return toast.error("Enter a hole ID");
    if ((longitude == null) !== (latitude == null)) return toast.error("Longitude and latitude must both be set or both blank");
    if (longitude == null || latitude == null) return toast.error("Longitude and latitude are required for mapped holes");
    if (azimuth != null && (azimuth < 0 || azimuth >= 360)) return toast.error("Azimuth must be between 0 and < 360");
    if (dip != null && (dip < -90 || dip > 90)) return toast.error("Dip must be between -90 and 90");

    setSavingAdminAction(true);
    try {
      const { error: updateError } = await supabase
        .from("holes")
        .update({
          project_id: form.project_id,
          hole_id: holeId,
          state: form.state || "proposed",
          planned_depth: toNullableNumber(form.planned_depth),
          depth: toNullableNumber(form.depth),
          water_level_m: toNullableNumber(form.water_level_m),
          azimuth,
          dip,
          collar_longitude: longitude,
          collar_latitude: latitude,
          collar_source: toTextOrNull(form.collar_source),
          completion_status: toTextOrNull(form.completion_status),
          completion_notes: toTextOrNull(form.completion_notes),
        })
        .eq("id", editingHole.id)
        .eq("organization_id", orgId);

      if (updateError) throw updateError;

      markViewportForPreserve(preserveViewportAfterRefreshRef);
      const { holes: freshHoles } = await loadData();
      const refreshedHole = freshHoles.find((hole) => hole.id === editingHole.id) || null;
      if (refreshedHole) focusHole(refreshedHole, { flyTo: false });
      setEditingHole(null);
      toast.success("Hole updated");
    } catch (error) {
      toast.error(error?.message || "Failed to update hole");
    } finally {
      setSavingAdminAction(false);
    }
  };

  const saveAssetEdits = async (form) => {
    if (!editingAsset || !canManageSelections) return;

    const trimmedName = String(form.name || "").trim();
    const longitude = toNullableNumber(form.longitude);
    const latitude = toNullableNumber(form.latitude);
    const selectedAssetType = assetTypes.find((type) => type.id === form.asset_type_id) || null;

    if (!form.project_id) return toast.error("Select a project");
    if (!trimmedName) return toast.error("Enter an asset name");
    if (!selectedAssetType) return toast.error("Select an asset type");
    if ((longitude == null) !== (latitude == null)) return toast.error("Longitude and latitude must both be set or both blank");
    if (longitude == null || latitude == null) return toast.error("Longitude and latitude are required for mapped assets");

    setSavingAdminAction(true);
    try {
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          project_id: form.project_id,
          name: trimmedName,
          asset_type_id: selectedAssetType.id,
          asset_type: selectedAssetType.name,
          location_id: form.location_id || null,
          status: form.status || "Active",
          longitude,
          latitude,
          coordinate_source: toTextOrNull(form.coordinate_source),
        })
        .eq("id", editingAsset.id)
        .eq("organization_id", orgId);

      if (updateError) throw updateError;

      markViewportForPreserve(preserveViewportAfterRefreshRef);
      const { assets: freshAssets } = await loadData();
      const refreshedAsset = freshAssets.find((asset) => asset.id === editingAsset.id) || null;
      if (refreshedAsset) focusAsset(refreshedAsset, { flyTo: false });
      setEditingAsset(null);
      toast.success("Asset updated");
    } catch (error) {
      toast.error(error?.message || "Failed to update asset");
    } finally {
      setSavingAdminAction(false);
    }
  };

  const deleteSelectedHole = async () => {
    if (!selectedHole || !canManageSelections) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete hole ${selectedHole.hole_id || ""}? This action cannot be undone.`)) return;

    setDeletingAdminAction(true);
    try {
      const { error: deleteError } = await supabase
        .from("holes")
        .delete()
        .eq("id", selectedHole.id)
        .eq("organization_id", orgId);

      if (deleteError) throw deleteError;

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      setSelectedHoleId("");
      markViewportForPreserve(preserveViewportAfterRefreshRef);
      await loadData();
      toast.success("Hole deleted");
    } catch (error) {
      toast.error(error?.message || "Failed to delete hole");
    } finally {
      setDeletingAdminAction(false);
    }
  };

  const deleteSelectedAsset = async () => {
    if (!selectedAsset || !canManageSelections) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete asset ${selectedAsset.name || ""}? This action cannot be undone.`)) return;

    setDeletingAdminAction(true);
    try {
      const { error: deleteError } = await supabase
        .from("assets")
        .delete()
        .eq("id", selectedAsset.id)
        .eq("organization_id", orgId);

      if (deleteError) throw deleteError;

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      setSelectedAssetId("");
      markViewportForPreserve(preserveViewportAfterRefreshRef);
      await loadData();
      toast.success("Asset deleted");
    } catch (error) {
      toast.error(error?.message || "Failed to delete asset");
    } finally {
      setDeletingAdminAction(false);
    }
  };

  useEffect(() => {
    const defaultProjectId = projectScope === "own" && projectFilter && ownProjects.some((project) => project.id === projectFilter)
      ? projectFilter
      : ownProjects[0]?.id || "";

    setHoleDraft((current) => (current.project_id && ownProjects.some((project) => project.id === current.project_id) ? current : createMapHoleDraft(defaultProjectId)));
    setAssetDraft((current) => (current.project_id && ownProjects.some((project) => project.id === current.project_id) ? current : createMapAssetDraft(defaultProjectId)));
  }, [ownProjects, projectFilter, projectScope]);

  const activeCreateDraft = createEntityType === "hole" ? holeDraft : assetDraft;
  const createPointCollection = useMemo(() => makeCreatePointCollection(activeCreateDraft), [activeCreateDraft]);

  const selectedHoleMapId = selectedHole?.id || "";
  const selectedAssetMapId = selectedAsset?.id || "";
  const holeCollection = useMemo(() => makeHoleFeatureCollection(visibleHoles), [visibleHoles]);
  const assetCollection = useMemo(() => makeAssetFeatureCollection(visibleAssets), [visibleAssets]);
  const locationProposalCollection = useMemo(
    () => makeMapLocationProposalFeatureCollection(locationProposals, visibleHoles, visibleAssets),
    [locationProposals, visibleAssets, visibleHoles]
  );

  const schematicLithById = useMemo(() => {
    const map = new Map();
    for (const type of schematicLithologyTypes || []) map.set(type.id, type);
    return map;
  }, [schematicLithologyTypes]);

  const schematicConstructionById = useMemo(() => {
    const map = new Map();
    for (const type of schematicConstructionTypes || []) map.set(type.id, type);
    return map;
  }, [schematicConstructionTypes]);

  const schematicAnnulusById = useMemo(() => {
    const map = new Map();
    for (const type of schematicAnnulusTypes || []) map.set(type.id, type);
    return map;
  }, [schematicAnnulusTypes]);

  useEffect(() => {
    setExpandedProjects((prev) => {
      const next = { ...prev };
      filteredProjects.forEach((project) => {
        if (typeof next[project.id] === "undefined") next[project.id] = false;
      });
      return next;
    });
  }, [filteredProjects]);

  useEffect(() => {
    setExpandedAssetProjects((prev) => {
      const next = { ...prev };
      filteredAssetProjects.forEach((project) => {
        if (typeof next[project.id] === "undefined") next[project.id] = false;
      });
      return next;
    });
  }, [filteredAssetProjects]);

  useEffect(() => {
    if (!visibleHoles.length) {
      setSelectedHoleId("");
      return;
    }
    if (!allowAutoSelectRef.current && !selectedHoleId) {
      return;
    }
    if (!visibleHoles.some((hole) => hole.id === selectedHoleId)) {
      setSelectedHoleId(visibleHoles[0].id);
    }
  }, [selectedHoleId, visibleHoles]);

  useEffect(() => {
    if (!visibleAssets.length) {
      setSelectedAssetId("");
      return;
    }
    if (!allowAutoSelectRef.current && !selectedAssetId) {
      return;
    }
    if (!visibleAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(visibleAssets[0].id);
    }
  }, [selectedAssetId, visibleAssets]);

  const frameRowsOnMap = (rows, options = {}) => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    const padding = options.padding || { top: 110, right: 90, bottom: 110, left: 90 };
    const maxZoom = typeof options.maxZoom === "number" ? options.maxZoom : 13;
    const duration = typeof options.duration === "number" ? options.duration : MAP_PROJECT_FRAME_DURATION;
    const singleZoom = typeof options.singleZoom === "number" ? options.singleZoom : 11.5;

    const mappableRows = (rows || []).filter((row) => {
      const lng = Number(row.collar_longitude ?? row.longitude);
      const lat = Number(row.collar_latitude ?? row.latitude);
      return Number.isFinite(lng) && Number.isFinite(lat);
    });

    if (!mappableRows.length) return;

    if (mappableRows.length === 1) {
      map.flyTo({
        center: [Number(mappableRows[0].collar_longitude ?? mappableRows[0].longitude), Number(mappableRows[0].collar_latitude ?? mappableRows[0].latitude)],
        zoom: singleZoom,
        speed: MAP_REFOCUS_SPEED,
        curve: MAP_REFOCUS_CURVE,
        easing: cinematicEase,
      });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    mappableRows.forEach((row) => {
      bounds.extend([Number(row.collar_longitude ?? row.longitude), Number(row.collar_latitude ?? row.latitude)]);
    });

    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration,
      easing: cinematicEase,
    });
  };

  const closeSchematicModal = () => {
    setSchematicHole(null);
    setSchematicError("");
  };

  const storeMapReturnState = (nextSelectedHoleId = selectedHoleId) => {
    if (typeof window === "undefined") return;

    const map = mapRef.current;
    const center = map?.getCenter?.();
    const snapshot = {
      projectScope,
      projectFilter,
      advancedFilters,
      navigatorTab,
      mobilePanelTab,
      selectedHoleId: nextSelectedHoleId || "",
      selectedAssetId: selectedAssetId || "",
      center: center ? [center.lng, center.lat] : null,
      zoom: map?.getZoom?.() ?? null,
      bearing: map?.getBearing?.() ?? null,
      pitch: map?.getPitch?.() ?? null,
      savedAt: Date.now(),
    };

    window.sessionStorage.setItem(MAP_RETURN_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  };

  const updateAdvancedFilter = (key, value) => {
    setAdvancedFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearAdvancedFilters = () => {
    setProjectFilter("");
    setAdvancedFilters(createEmptyMapAdvancedFilters());
  };

  const openSchematicModal = async (hole) => {
    if (!hole?.id || !hole.organization_id) return;
    storeMapReturnState(hole.id);
    const params = new URLSearchParams({
      holeId: hole.id,
      from: "map",
      scope: projectScope,
    });
    router.push(`/drillhole-viz?${params.toString()}`);
  };

  const openCoreTasksPage = (hole) => {
    if (!hole?.id) return;
    storeMapReturnState(hole.id);
    const params = new URLSearchParams({
      holeId: hole.id,
      from: "map",
      scope: projectScope,
      tab: "logging",
    });
    router.push(`/coretasks?${params.toString()}`);
  };

  const renderPopupHtml = (hole) => {
    if (!hole) return "";
    const stateTone = getHoleStateTone(hole.state);
    const pendingProposal = pendingProposalByEntity.get(getMapProposalEntityKey("hole", hole.id)) || null;
    const descriptorMarkup = (hole.descriptors || [])
      .slice(0, 2)
      .map(
        (descriptor) =>
          `<span class="map-popup-chip">${descriptor.name}</span>`
      )
      .join("");

    return `
      <div class="map-popup-shell">
        <div class="map-popup-header">
          <div class="map-popup-copy">
            <div class="map-popup-kicker">Hole</div>
            <div class="map-popup-title">${hole.hole_id || "Unnamed hole"}</div>
            <div class="map-popup-subtitle">${hole.project_name || "No project"}</div>
          </div>
          <div class="map-popup-badges">
            <span class="map-popup-badge map-popup-badge-state" style="--popup-badge-border:${stateTone.border};--popup-badge-bg:${stateTone.background};--popup-badge-color:${stateTone.text};">
              ${stateTone.label}
            </span>
            ${pendingProposal ? `<span class="map-popup-badge map-popup-badge-pending">Pending</span>` : ""}
          </div>
        </div>
        <div class="map-popup-detail-row">
          <span class="map-popup-detail-label">Planned Depth</span>
          <span class="map-popup-detail-value">${formatValue(hole.planned_depth, " m")}</span>
        </div>
        ${descriptorMarkup ? `<div class="map-popup-chip-row">${descriptorMarkup}</div>` : ""}
      </div>
    `;
  };

  const renderAssetPopupHtml = (asset) => {
    if (!asset) return "";
    const pendingProposal = pendingProposalByEntity.get(getMapProposalEntityKey("asset", asset.id)) || null;

    return `
      <div class="map-popup-shell">
        <div class="map-popup-header">
          <div class="map-popup-copy">
            <div class="map-popup-kicker">Asset</div>
            <div class="map-popup-title">${asset.name || "Unnamed asset"}</div>
            <div class="map-popup-subtitle">${asset.project_name || "No project"}</div>
          </div>
          <div class="map-popup-badges">
            <span class="map-popup-badge map-popup-badge-status">
              ${asset.status || "Unknown"}
            </span>
            ${pendingProposal ? `<span class="map-popup-badge map-popup-badge-pending">Pending</span>` : ""}
          </div>
        </div>
        <div class="map-popup-detail-row">
          <span class="map-popup-detail-label">Type</span>
          <span class="map-popup-detail-value">${asset.asset_type_name || "-"}</span>
        </div>
      </div>
    `;
  };

  const applyPopupViewportLayout = (popup) => {
    const popupElement = popup?.getElement?.();
    if (!popupElement) return;

    popupElement.classList.toggle("hole-map-popup-mobile", isMobileViewport);
  };

  const focusHole = (hole, options = {}) => {
    if (!hole) return;
    allowAutoSelectRef.current = true;
    setNavigatorTab("holes");
    setSelectedHoleId(hole.id);
    setMobilePanelTab("holes");

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const lng = Number(hole.collar_longitude);
    const lat = Number(hole.collar_latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo(getSelectionFlyTo(map, [lng, lat], typeof options.zoom === "number" ? options.zoom : MAP_SELECTION_ZOOM));
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true, className: "hole-map-popup" });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderPopupHtml(hole)).addTo(map);
    applyPopupViewportLayout(popupRef.current);
  };

  const focusAsset = (asset, options = {}) => {
    if (!asset) return;
    allowAutoSelectRef.current = true;
    setNavigatorTab("assets");
    setSelectedAssetId(asset.id);
    setMobilePanelTab("assets");

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const lng = Number(asset.longitude);
    const lat = Number(asset.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo(getSelectionFlyTo(map, [lng, lat], typeof options.zoom === "number" ? options.zoom : MAP_ASSET_SELECTION_ZOOM));
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true, className: "hole-map-popup" });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderAssetPopupHtml(asset)).addTo(map);
    applyPopupViewportLayout(popupRef.current);
  };

  useEffect(() => {
    applyPopupViewportLayout(popupRef.current);
  }, [isMobileViewport]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    if (map.getSource(HOLES_SOURCE_ID)) {
      map.getSource(HOLES_SOURCE_ID).setData(holeCollection);
    } else {
      map.addSource(HOLES_SOURCE_ID, { type: "geojson", data: holeCollection });
    }

    if (map.getSource(ASSETS_SOURCE_ID)) {
      map.getSource(ASSETS_SOURCE_ID).setData(assetCollection);
    } else {
      map.addSource(ASSETS_SOURCE_ID, { type: "geojson", data: assetCollection });
    }

    if (map.getSource(CREATE_POINT_SOURCE_ID)) {
      map.getSource(CREATE_POINT_SOURCE_ID).setData(createPointCollection);
    } else {
      map.addSource(CREATE_POINT_SOURCE_ID, { type: "geojson", data: createPointCollection });
    }

    if (map.getSource(LOCATION_PROPOSALS_SOURCE_ID)) {
      map.getSource(LOCATION_PROPOSALS_SOURCE_ID).setData(locationProposalCollection);
    } else {
      map.addSource(LOCATION_PROPOSALS_SOURCE_ID, { type: "geojson", data: locationProposalCollection });
    }

    if (!map.getLayer(HOLES_GLOW_LAYER_ID)) {
      map.addLayer({
        id: HOLES_GLOW_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": "#22d3ee",
          "circle-opacity": 0.14,
          "circle-blur": 0.85,
        },
      });
    }

    if (!map.getLayer(HOLES_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: HOLES_CIRCLE_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": HOLE_STATE_COLOR_EXPRESSION,
          "circle-stroke-color": "#082f49",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0.96,
        },
      });
    }

    if (map.getLayer(HOLES_CIRCLE_LAYER_ID)) {
      map.setPaintProperty(HOLES_CIRCLE_LAYER_ID, "circle-color", HOLE_STATE_COLOR_EXPRESSION);
    }

    if (!map.getLayer(HOLES_SELECTED_LAYER_ID)) {
      map.addLayer({
        id: HOLES_SELECTED_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(249,115,22,0.22)",
          "circle-stroke-color": "#fb923c",
          "circle-stroke-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    if (!map.getLayer(HOLES_LABEL_LAYER_ID)) {
      map.addLayer({
        id: HOLES_LABEL_LAYER_ID,
        type: "symbol",
        source: HOLES_SOURCE_ID,
        layout: {
          "text-field": ["get", "hole_id"],
          "text-size": 11,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.35],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(2, 6, 23, 0.92)",
          "text-halo-width": 1.4,
        },
      });
    }

    if (!map.getLayer(ASSETS_GLOW_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_GLOW_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 16,
          "circle-color": ASSET_COLOR,
          "circle-opacity": 0.12,
          "circle-blur": 0.8,
        },
      });
    }

    if (!map.getLayer(ASSETS_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_CIRCLE_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 6,
          "circle-color": ASSET_COLOR,
          "circle-stroke-color": "#fbcfe8",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
    }

    if (map.getLayer(ASSETS_CIRCLE_LAYER_ID)) {
      map.setPaintProperty(ASSETS_CIRCLE_LAYER_ID, "circle-color", ASSET_COLOR);
    }

    if (!map.getLayer(ASSETS_SELECTED_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_SELECTED_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(244,114,182,0.18)",
          "circle-stroke-color": "#f9a8d4",
          "circle-stroke-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    if (!map.getLayer(CREATE_POINT_FILL_LAYER_ID)) {
      map.addLayer({
        id: CREATE_POINT_FILL_LAYER_ID,
        type: "circle",
        source: CREATE_POINT_SOURCE_ID,
        paint: {
          "circle-radius": 8,
          "circle-color": "#f97316",
          "circle-opacity": 0.96,
        },
      });
    }

    if (!map.getLayer(CREATE_POINT_RING_LAYER_ID)) {
      map.addLayer({
        id: CREATE_POINT_RING_LAYER_ID,
        type: "circle",
        source: CREATE_POINT_SOURCE_ID,
        paint: {
          "circle-radius": 15,
          "circle-color": "rgba(249,115,22,0.12)",
          "circle-stroke-color": "#fdba74",
          "circle-stroke-width": 2,
        },
      });
    }

    if (!map.getLayer(LOCATION_PROPOSALS_LINE_LAYER_ID)) {
      map.addLayer({
        id: LOCATION_PROPOSALS_LINE_LAYER_ID,
        type: "line",
        source: LOCATION_PROPOSALS_SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
          "line-opacity": 0.88,
          "line-dasharray": [2, 2],
        },
      });
    }

    if (!map.getLayer(LOCATION_PROPOSALS_ARROW_LAYER_ID)) {
      map.addLayer({
        id: LOCATION_PROPOSALS_ARROW_LAYER_ID,
        type: "symbol",
        source: LOCATION_PROPOSALS_SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 80,
          "text-field": ">",
          "text-size": 13,
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(2,6,23,0.95)",
          "text-halo-width": 1,
        },
      });
    }

    if (!map.getLayer(LOCATION_PROPOSALS_POINT_RING_LAYER_ID)) {
      map.addLayer({
        id: LOCATION_PROPOSALS_POINT_RING_LAYER_ID,
        type: "circle",
        source: LOCATION_PROPOSALS_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 13,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.16,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1.6,
        },
      });
    }

    if (!map.getLayer(LOCATION_PROPOSALS_POINT_LAYER_ID)) {
      map.addLayer({
        id: LOCATION_PROPOSALS_POINT_LAYER_ID,
        type: "circle",
        source: LOCATION_PROPOSALS_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#f8fafc",
          "circle-stroke-width": 2,
          "circle-opacity": 0.98,
        },
      });
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHoleMapId]);
    map.setFilter(ASSETS_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedAssetMapId]);

    if (!handlersBoundRef.current) {
      const setPointerCursor = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const clearPointerCursor = () => {
        map.getCanvas().style.cursor = createPlacementActiveRef.current || !!moveSelectionRef.current || !!proposalPlacementSelectionRef.current ? "crosshair" : "";
      };
      const handleHoleLayerClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const hole = visibleHolesRef.current.find((row) => String(row.id) === String(feature.properties?.id));
        if (!hole) return;
        focusHole(hole);
      };
      const handleAssetLayerClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const asset = visibleAssetsRef.current.find((row) => String(row.id) === String(feature.properties?.id));
        if (!asset) return;
        focusAsset(asset);
      };
      const handleMapCreateClick = (event) => {
        const overlappingFeatures = map.queryRenderedFeatures(event.point, {
          layers: [
            HOLES_CIRCLE_LAYER_ID,
            HOLES_SELECTED_LAYER_ID,
            ASSETS_CIRCLE_LAYER_ID,
            ASSETS_SELECTED_LAYER_ID,
            LOCATION_PROPOSALS_POINT_LAYER_ID,
            LOCATION_PROPOSALS_POINT_RING_LAYER_ID,
            LOCATION_PROPOSALS_LINE_LAYER_ID,
          ],
        });

        if (!createPlacementActiveRef.current && !moveSelectionRef.current && !proposalPlacementSelectionRef.current) {
          if (overlappingFeatures.length) return;
          clearMapSelectionState({
            setSelectedHoleId,
            setSelectedAssetId,
            popupRef,
            allowAutoSelectRef,
          });
          return;
        }

        if (overlappingFeatures.length) return;

        const nextLongitude = roundCoordinate(event.lngLat.lng);
        const nextLatitude = roundCoordinate(event.lngLat.lat);

        if (moveSelectionRef.current) {
          void (async () => {
            if (savingMoveSelection) return;

            setSavingMoveSelection(true);
            try {
              if (moveSelectionRef.current.entityType === "hole") {
                const { error: updateError } = await supabase
                  .from("holes")
                  .update({
                    collar_longitude: Number(nextLongitude),
                    collar_latitude: Number(nextLatitude),
                    collar_source: DEFAULT_HOLE_COLLAR_SOURCE,
                  })
                  .eq("id", moveSelectionRef.current.entityId)
                  .eq("organization_id", orgId);

                if (updateError) throw updateError;

                markViewportForPreserve(preserveViewportAfterRefreshRef);
                const { holes: freshHoles } = await loadData();
                const movedHole = freshHoles.find((hole) => hole.id === moveSelectionRef.current.entityId) || null;
                setMoveSelection(null);
                if (movedHole) focusHole(movedHole);
                toast.success("Hole moved");
              } else {
                const { error: updateError } = await supabase
                  .from("assets")
                  .update({
                    longitude: Number(nextLongitude),
                    latitude: Number(nextLatitude),
                    coordinate_source: "manual",
                  })
                  .eq("id", moveSelectionRef.current.entityId)
                  .eq("organization_id", orgId);

                if (updateError) throw updateError;

                markViewportForPreserve(preserveViewportAfterRefreshRef);
                const { assets: freshAssets } = await loadData();
                const movedAsset = freshAssets.find((asset) => asset.id === moveSelectionRef.current.entityId) || null;
                setMoveSelection(null);
                if (movedAsset) focusAsset(movedAsset);
                toast.success("Asset moved");
              }
            } catch (error) {
              toast.error(error?.message || "Failed to move point");
            } finally {
              setSavingMoveSelection(false);
            }
          })();
          return;
        }

        if (proposalPlacementSelectionRef.current) {
          const selection = proposalPlacementSelectionRef.current;
          const entity = selection.entity;
          const currentLongitude = selection.entityType === "hole" ? entity?.collar_longitude : entity?.longitude;
          const currentLatitude = selection.entityType === "hole" ? entity?.collar_latitude : entity?.latitude;

          setProposalPlacementSelection(null);
          setProposalDraft({
            proposalId: selection.proposalId || null,
            entityType: selection.entityType,
            entityId: selection.entityId,
            label: selection.label,
            currentLongitude,
            currentLatitude,
            proposedLongitude: nextLongitude,
            proposedLatitude: nextLatitude,
            note: selection.note || "",
          });
          return;
        }

        if (createEntityTypeRef.current === "hole") {
          setHoleDraft((current) => ({
            ...current,
            longitude: nextLongitude,
            latitude: nextLatitude,
            collar_source: normalizeHoleCollarSource(current.collar_source),
          }));
        } else {
          setAssetDraft((current) => ({
            ...current,
            longitude: nextLongitude,
            latitude: nextLatitude,
            coordinate_source: "manual",
          }));
        }

        map.easeTo({
          center: [Number(nextLongitude), Number(nextLatitude)],
          zoom: Math.max(map.getZoom(), 11.2),
          duration: 450,
        });

        setShowCreatePanel(true);
      };

      map.on("mouseenter", HOLES_CIRCLE_LAYER_ID, setPointerCursor);
      map.on("mouseenter", HOLES_SELECTED_LAYER_ID, setPointerCursor);
      map.on("mouseenter", ASSETS_CIRCLE_LAYER_ID, setPointerCursor);
      map.on("mouseenter", ASSETS_SELECTED_LAYER_ID, setPointerCursor);
      map.on("mouseleave", HOLES_CIRCLE_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", HOLES_SELECTED_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", ASSETS_CIRCLE_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", ASSETS_SELECTED_LAYER_ID, clearPointerCursor);
      map.on("click", HOLES_CIRCLE_LAYER_ID, handleHoleLayerClick);
      map.on("click", HOLES_SELECTED_LAYER_ID, handleHoleLayerClick);
      map.on("click", ASSETS_CIRCLE_LAYER_ID, handleAssetLayerClick);
      map.on("click", ASSETS_SELECTED_LAYER_ID, handleAssetLayerClick);
      map.on("click", handleMapCreateClick);
      handlersBoundRef.current = true;
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHoleMapId]);
    map.setFilter(ASSETS_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedAssetMapId]);

    if (!visibleHoles.length && !visibleAssets.length) {
      if (popupRef.current) popupRef.current.remove();
      return;
    }
  }, [assetCollection, createPointCollection, holeCollection, locationProposalCollection, mapStatus, selectedAssetMapId, selectedHoleMapId, visibleAssets.length, visibleHoles.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const showAssetLayers = !isMobileViewport || mobilePanelTab === "assets";
    const showHoleLayers = !isMobileViewport || mobilePanelTab === "holes";

    const setLayerVisibility = (layerId, visible) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    };

    setLayerVisibility(HOLES_GLOW_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_CIRCLE_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_SELECTED_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_LABEL_LAYER_ID, showHoleLayers);
    setLayerVisibility(ASSETS_GLOW_LAYER_ID, showAssetLayers);
    setLayerVisibility(ASSETS_CIRCLE_LAYER_ID, showAssetLayers);
    setLayerVisibility(ASSETS_SELECTED_LAYER_ID, showAssetLayers);
    setLayerVisibility(CREATE_POINT_FILL_LAYER_ID, createPlacementActive);
    setLayerVisibility(CREATE_POINT_RING_LAYER_ID, createPlacementActive);
  }, [createPlacementActive, isMobileViewport, mapStatus, mobilePanelTab]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

      map.getCanvas().style.cursor = createPlacementActive || !!moveSelection || !!proposalPlacementSelection ? "crosshair" : "";
    }, [createPlacementActive, moveSelection, proposalPlacementSelection]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    if (pendingMapRestoreRef.current || applyingMapRestoreRef.current) return;

    if (preserveViewportAfterRefreshRef.current) {
      preserveViewportAfterRefreshRef.current = false;
      return;
    }

    const visibleMapRows = isMobileViewport ? (mobilePanelTab === "assets" ? visibleAssets : visibleHoles) : [...visibleHoles, ...visibleAssets];

    if (!visibleMapRows.length) {
      if (popupRef.current) popupRef.current.remove();
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING });
      return;
    }

    frameRowsOnMap(visibleMapRows);
  }, [isMobileViewport, mapStatus, mobilePanelTab, visibleAssets, visibleHoles]);

  useEffect(() => {
    const map = mapRef.current;
    const snapshot = pendingMapRestoreRef.current;
    if (!map || !mapReadyRef.current || !snapshot || loading) return;

    applyingMapRestoreRef.current = true;

    const center = Array.isArray(snapshot.center) && snapshot.center.length === 2
      ? snapshot.center.map((value) => Number(value))
      : null;
    const zoom = Number(snapshot.zoom);
    const bearing = Number(snapshot.bearing);
    const pitch = Number(snapshot.pitch);

    if (center && center.every((value) => Number.isFinite(value))) {
      map.jumpTo({
        center,
        zoom: Number.isFinite(zoom) ? zoom : map.getZoom(),
        bearing: Number.isFinite(bearing) ? bearing : map.getBearing(),
        pitch: Number.isFinite(pitch) ? pitch : map.getPitch(),
      });
    }

    const nextHole = snapshot.selectedHoleId
      ? visibleHoles.find((hole) => hole.id === snapshot.selectedHoleId)
      : null;
    const nextAsset = snapshot.selectedAssetId
      ? visibleAssets.find((asset) => asset.id === snapshot.selectedAssetId)
      : null;

    if (nextHole) {
      focusHole(nextHole, { flyTo: false });
    } else if (nextAsset) {
      focusAsset(nextAsset, { flyTo: false });
    } else if (popupRef.current) {
      popupRef.current.remove();
    }

    pendingMapRestoreRef.current = null;
    applyingMapRestoreRef.current = false;
  }, [loading, visibleAssets, visibleHoles]);

  useEffect(() => {
    const pendingHoleId = pendingHoleFocusRef.current;
    if (!pendingHoleId || loading || !mapReadyRef.current || pendingMapRestoreRef.current || applyingMapRestoreRef.current) {
      return;
    }

    const nextHole = visibleHoles.find((hole) => hole.id === pendingHoleId);
    if (!nextHole) return;

    focusHole(nextHole);
    pendingHoleFocusRef.current = "";
  }, [loading, visibleHoles]);

  const totalProjects = projectOptions.length;
  const totalVisibleProjects = useMemo(() => {
    return new Set([...filteredProjects.map((project) => project.id), ...filteredAssetProjects.map((project) => project.id)]).size;
  }, [filteredAssetProjects, filteredProjects]);
  const totalVisibleHoles = visibleHoles.length;
  const totalVisibleAssets = visibleAssets.length;
  const totalShared = visibleHoles.filter((hole) => hole.organization_id !== orgId).length;
  const totalVisibleEntities = totalVisibleHoles + totalVisibleAssets;
  const visibleEntityBars = useMemo(() => {
    if (!totalVisibleEntities) return [];
    return [
      { value: (totalVisibleHoles / totalVisibleEntities) * 100, color: "#38bdf8" },
      { value: (totalVisibleAssets / totalVisibleEntities) * 100, color: ASSET_COLOR },
    ];
  }, [totalVisibleAssets, totalVisibleEntities, totalVisibleHoles]);
  const visibleHoleStateBars = useMemo(() => {
    if (!totalVisibleHoles) return [];
    return HOLE_STATE_STYLES.map((item) => {
      const count = visibleHoles.filter((hole) => hole.state === item.value).length;
      return {
        color: item.color,
        value: (count / totalVisibleHoles) * 100,
        count,
      };
    }).filter((item) => item.count > 0);
  }, [totalVisibleHoles, visibleHoles]);
  const sharedCoverage = totalVisibleHoles ? Math.round((totalShared / totalVisibleHoles) * 100) : 0;
  const scopeLabel = projectScope === "shared" ? "Client shared mode" : "My projects mode";
  const projectFocusLabel = projectFilter ? "Project focus active" : "Portfolio view";
  const showCreateProjectPrompt = !loading && projectScope === "own" && totalProjects === 0;

  const toggleProjectExpanded = (project, isExpanded) => {
    setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }));
    frameRowsOnMap(project.holes, {
      padding: { top: 56, right: 38, bottom: 56, left: 38 },
      maxZoom: 15.2,
      duration: 3000,
      singleZoom: 14.1,
    });
  };

  const toggleAssetProjectExpanded = (project, isExpanded) => {
    setExpandedAssetProjects((prev) => ({ ...prev, [project.id]: !isExpanded }));
    frameRowsOnMap(project.assets, {
      padding: { top: 56, right: 38, bottom: 56, left: 38 },
      maxZoom: 15.2,
      duration: 3000,
      singleZoom: 14.1,
    });
  };

  const openCreatePanel = (entityType = "hole") => {
    if (projectScope !== "own") {
      toast.error("Create on map is available in My Projects only");
      return;
    }

    const defaultProjectId = projectFilter && ownProjects.some((project) => project.id === projectFilter)
      ? projectFilter
      : ownProjects[0]?.id || "";

    setCreateEntityType(entityType);
    setHoleDraft((current) => ({ ...createMapHoleDraft(defaultProjectId), longitude: current.longitude, latitude: current.latitude }));
    setAssetDraft((current) => ({ ...createMapAssetDraft(defaultProjectId), longitude: current.longitude, latitude: current.latitude }));
    setCreatePlacementActive(true);
    setShowCreatePanel(false);
    toast("Click a free point on the map to place your new item.");
  };

  const closeCreatePanel = () => {
    setShowCreatePanel(false);
    setCreatePlacementActive(false);
    setSavingCreateEntity(false);
  };

  const saveCreatedHole = async () => {
    const holeId = String(holeDraft.hole_id || "").trim();
    const longitude = Number(holeDraft.longitude);
    const latitude = Number(holeDraft.latitude);
    const selectedProject = ownProjects.find((project) => project.id === holeDraft.project_id) || null;

    if (!selectedProject) {
      toast.error("Select a project first");
      return;
    }

    if (!holeId) {
      toast.error("Enter a hole ID");
      return;
    }

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      toast.error("Click a point on the map first");
      return;
    }

    setSavingCreateEntity(true);

    const { data, error: insertError } = await supabase
      .from("holes")
      .insert({
        organization_id: orgId,
        project_id: selectedProject.id,
        hole_id: holeId,
        state: holeDraft.state || "proposed",
        collar_longitude: longitude,
        collar_latitude: latitude,
        collar_source: normalizeHoleCollarSource(holeDraft.collar_source),
      })
      .select("id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state")
      .single();

    if (insertError) {
      setSavingCreateEntity(false);
      toast.error(insertError.message || "Failed to create hole");
      return;
    }

    const createdHole = {
      ...data,
      project_name: selectedProject.name,
      descriptors: [],
      descriptor_ids: [],
    };

    markViewportForPreserve(preserveViewportAfterRefreshRef);
    await loadData();
    closeCreatePanel();
    setNavigatorTab("holes");
    setMobilePanelTab("holes");
    focusHole(createdHole);
    toast.success("Hole created from map");
  };

  const saveCreatedAsset = async () => {
    const assetName = String(assetDraft.name || "").trim();
    const longitude = Number(assetDraft.longitude);
    const latitude = Number(assetDraft.latitude);
    const selectedProject = ownProjects.find((project) => project.id === assetDraft.project_id) || null;
    const selectedAssetType = assetTypes.find((type) => type.id === assetDraft.asset_type_id) || null;
    const selectedLocation = assetLocations.find((location) => location.id === assetDraft.location_id) || null;

    if (!selectedProject) {
      toast.error("Select a project first");
      return;
    }

    if (!assetName) {
      toast.error("Enter an asset name");
      return;
    }

    if (!selectedAssetType) {
      toast.error("Select an asset type");
      return;
    }

    if (!selectedLocation) {
      toast.error("Select a location");
      return;
    }

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      toast.error("Click a point on the map first");
      return;
    }

    setSavingCreateEntity(true);

    const { data, error: insertError } = await supabase
      .from("assets")
      .insert({
        organization_id: orgId,
        name: assetName,
        asset_type: selectedAssetType.name,
        asset_type_id: selectedAssetType.id,
        location_id: selectedLocation.id,
        project_id: selectedProject.id,
        longitude,
        latitude,
        coordinate_source: assetDraft.coordinate_source || "manual",
        status: assetDraft.status || "Active",
      })
      .select("id,organization_id,name,project_id,status,easting,northing,longitude,latitude,coordinate_source")
      .single();

    if (insertError) {
      setSavingCreateEntity(false);
      toast.error(insertError.message || "Failed to create asset");
      return;
    }

    const createdAsset = {
      ...data,
      project_name: selectedProject.name,
      project_crs_code: selectedProject.coordinate_crs_code || null,
      project_crs_name: selectedProject.coordinate_crs_name || null,
      asset_type_name: selectedAssetType.name,
      location_name: selectedLocation.name,
    };

    markViewportForPreserve(preserveViewportAfterRefreshRef);
    await loadData();
    closeCreatePanel();
    setNavigatorTab("assets");
    setMobilePanelTab("assets");
    focusAsset(createdAsset);
    toast.success("Asset created from map");
  };

  const saveCreateEntity = async () => {
    if (savingCreateEntity) return;
    if (createEntityType === "hole") {
      await saveCreatedHole();
      return;
    }

    await saveCreatedAsset();
  };

  const mobileSelectionTitle = mobilePanelTab === "holes"
    ? selectedHole?.hole_id || "Hole attributes"
    : selectedAsset?.name || "Mapped assets";

  const attributesTab = isMobileViewport ? mobilePanelTab : navigatorTab;
  const attributesTitle = attributesTab === "holes"
    ? selectedHole?.hole_id || "Hole attributes"
    : selectedAsset?.name || "Asset attributes";
  const attributesSubtitle = attributesTab === "holes"
    ? selectedHole
      ? `Inspecting ${selectedHole.hole_id}`
      : "Click a hole on the map or in the project list."
    : selectedAsset
      ? `Inspecting ${selectedAsset.name}`
      : "Click an asset on the map or in the assets list.";

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent px-3 pb-24 pt-0 md:px-5 md:pb-8 md:pt-0">
      <div className="mx-auto max-w-[1600px] space-y-4 overflow-x-hidden">
        <section className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/40 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:block">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(8,47,73,0.65)_45%,rgba(120,53,15,0.48))] px-4 py-5 md:px-6">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                    Spatial Drillhole Workspace
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-200">
                    {scopeLabel}
                  </span>
                  {activeAdvancedFilterCount ? (
                    <span className="rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-100">
                      {activeAdvancedFilterCount} filter{activeAdvancedFilterCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[12px] uppercase tracking-[0.24em] text-slate-400">Map command center</div>
                    <div className="mt-1 text-lg font-semibold text-white">{isOverviewStripCollapsed ? "Focused workspace summary" : "Live spatial overview"}</div>
                    <p className="mt-1 text-sm text-slate-300">
                      {isOverviewStripCollapsed
                        ? "A compact read on what is visible right now, with the full KPI view one tap away."
                        : "Full coverage, shared visibility, and scope health for the current map view."}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${isOverviewStripCollapsed ? "bg-cyan-300" : "bg-amber-300"}`} />
                    {isOverviewStripCollapsed ? "Collapsed by default" : "Expanded overview"}
                  </div>
                </div>
              </div>

              <OverviewToggleButton
                collapsed={isOverviewStripCollapsed}
                onClick={() => setIsOverviewStripCollapsed((current) => !current)}
              />
            </div>

            {isOverviewStripCollapsed ? (
              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.45fr)] xl:items-center">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(140deg,rgba(15,23,42,0.84),rgba(8,47,73,0.52),rgba(15,118,110,0.2))] px-4 py-4 shadow-[0_20px_56px_rgba(2,6,23,0.22)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Current focus</div>
                  <div className="mt-2 text-xl font-semibold text-white">{projectFocusLabel}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    {loading ? "Refreshing visible map totals..." : `${totalVisibleEntities} entities are in view across the current map scope.`}
                  </div>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/20">
                    {visibleEntityBars.map((bar, index) => (
                      <span
                        key={`collapsed-visible-entity-${index}`}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${Math.max(0, Math.min(100, Number(bar.value) || 0))}%`, backgroundColor: bar.color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <div className="rounded-[22px] border border-cyan-300/12 bg-cyan-400/[0.05] px-4 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Projects</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleProjects}</div>
                    <div className="mt-1 text-xs text-slate-300">In current scope</div>
                  </div>
                  <div className="rounded-[22px] border border-amber-300/12 bg-amber-400/[0.05] px-4 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Holes</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleHoles}</div>
                    <div className="mt-1 text-xs text-slate-300">Mapped drillholes</div>
                  </div>
                  <div className="rounded-[22px] border border-rose-300/12 bg-rose-400/[0.05] px-4 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Assets</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleAssets}</div>
                    <div className="mt-1 text-xs text-slate-300">Mapped equipment</div>
                  </div>
                  <div className="rounded-[22px] border border-emerald-300/12 bg-emerald-400/[0.05] px-4 py-3 shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Shared</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalShared}</div>
                    <div className="mt-1 text-xs text-slate-300">Visible shared holes</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(320px,1.15fr)_minmax(560px,1fr)] xl:items-stretch">
                <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(140deg,rgba(15,23,42,0.9),rgba(8,47,73,0.58),rgba(15,118,110,0.28))] px-4 py-4 shadow-[0_24px_70px_rgba(2,6,23,0.28)]">
                  <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_68%)]" />
                  <div className="relative">
                    <div className="flex items-end justify-between gap-4">
                      <div className="max-w-md">
                        <div className="text-[12px] uppercase tracking-[0.24em] text-slate-400">Live Overview</div>
                        <div className="mt-2 text-[1.65rem] font-semibold leading-8 text-white">Map command center</div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Fast read on mapped coverage, shared visibility, and the current working scope.
                        </p>
                      </div>
                      <div className="min-w-[128px] rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-right">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Visible entities</div>
                        <div className="mt-2 text-3xl font-semibold text-white">{loading ? "..." : totalVisibleEntities}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/20">
                      {visibleEntityBars.map((bar, index) => (
                        <span
                          key={`visible-entity-${index}`}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${Math.max(0, Math.min(100, Number(bar.value) || 0))}%`, backgroundColor: bar.color }}
                        />
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalVisibleHoles} holes</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalVisibleAssets} assets</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{projectFocusLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MapOverviewKpi
                    label="Visible Projects"
                    value={loading ? "..." : totalVisibleProjects}
                    detail={`${projectFocusLabel} across ${totalProjects || 0} total project${totalProjects === 1 ? "" : "s"}`}
                    bars={[{ value: totalProjects ? (totalVisibleProjects / totalProjects) * 100 : 0, color: "#22d3ee" }]}
                    tone="cyan"
                  />
                  <MapOverviewKpi
                    label="Mapped Holes"
                    value={loading ? "..." : totalVisibleHoles}
                    detail={totalVisibleHoles ? `${totalShared} shared hole${totalShared === 1 ? "" : "s"} currently visible` : "No holes visible in current scope"}
                    bars={visibleHoleStateBars}
                    tone="amber"
                  />
                  <MapOverviewKpi
                    label="Mapped Assets"
                    value={loading ? "..." : totalVisibleAssets}
                    detail={activeAdvancedFilterCount ? `${activeAdvancedFilterCount} active filter${activeAdvancedFilterCount === 1 ? "" : "s"} shaping asset view` : "All mapped assets in current scope"}
                    bars={[{ value: totalVisibleEntities ? (totalVisibleAssets / totalVisibleEntities) * 100 : 0, color: ASSET_COLOR }]}
                    tone="rose"
                  />
                  <MapOverviewKpi
                    label="Shared In View"
                    value={loading ? "..." : totalShared}
                    detail={totalVisibleHoles ? `${sharedCoverage}% of visible holes are shared into this workspace` : "Shared visibility appears when shared holes enter the current view"}
                    bars={[
                      { value: sharedCoverage, color: "#34d399" },
                      { value: Math.max(0, 100 - sharedCoverage), color: "rgba(255,255,255,0.1)" },
                    ]}
                    tone="emerald"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-4 md:px-6 md:py-5">
            <MapWorkflowStageStrip
              workflowVisual={selectedHoleWorkflowVisual}
              selectedHole={selectedHole}
              canManageSelections={canManageSelections}
              signingPhaseId={signingWorkflowPhaseId}
              onSelectPhase={handleStageGateSelect}
              selectedPhaseId={selectedWorkflowPhaseId}
            />
            {mapNotice ? <div className="mt-3 text-sm text-amber-300">{mapNotice}</div> : null}
            {error ? <div className="mt-3 text-sm text-rose-300">{error}</div> : null}
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[350px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl xl:block">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-5">
              <div className="w-full">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Map Navigator</div>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${navigatorTab === "holes" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setNavigatorTab("holes")}
                  >
                    Holes
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${navigatorTab === "assets" ? "bg-rose-300 text-slate-950 shadow-[0_12px_28px_rgba(244,114,182,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setNavigatorTab("assets")}
                  >
                    Assets
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {navigatorTab === "holes" ? (
                <ProjectAccordionList
                  loading={loading}
                  projects={filteredProjects}
                  expandedProjects={expandedProjects}
                  onToggleProject={toggleProjectExpanded}
                  selectedHoleId={selectedHole?.id || ""}
                  onSelectHole={focusHole}
                />
              ) : (
                <>
                  <AssetTypeNavigatorFilter
                    value={assetNavigatorTypeFilter}
                    onChange={setAssetNavigatorTypeFilter}
                    options={assetTypeOptions}
                    resultCount={visibleAssets.length}
                  />
                  <AssetAccordionList
                    loading={loading}
                    projects={filteredAssetProjects}
                    expandedProjects={expandedAssetProjects}
                    onToggleProject={toggleAssetProjectExpanded}
                    selectedAssetId={selectedAsset?.id || ""}
                    onSelectAsset={focusAsset}
                    activeTypeLabel={activeAssetNavigatorTypeLabel}
                  />
                </>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <div
              ref={mapCardRef}
              className={[
                "relative min-w-0 overflow-hidden border border-white/10 bg-slate-950/60 shadow-[0_30px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl",
                isMapFullscreen ? "h-full rounded-none" : "rounded-[32px]",
              ].join(" ")}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(8,47,73,0.28),transparent)]" />
              <div className="relative border-b border-white/10 px-4 py-4 md:hidden">
                <div className="flex flex-col items-start gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Map View</div>
                    <div className="mt-1 text-lg font-semibold text-white">{mobileSelectionTitle}</div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 min-[360px]:w-auto">
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
                      onClick={() => setShowAttributesDrawer(true)}
                    >
                      <AttributesIcon className="h-[18px] w-[18px]" />
                      <span>Attributes</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-300/18 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                      onClick={() => openCoreTasksPage(selectedHole)}
                      disabled={!selectedHole}
                    >
                      <CoreTasksIcon className="h-[18px] w-[18px]" />
                      <span>Core tasks</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Open filters"
                      title="Open filters"
                      className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.1]"
                      onClick={() => setShowAdvancedFilters(true)}
                    >
                      <FilterIcon className="h-[18px] w-[18px] text-cyan-200" />
                      {activeAdvancedFilterCount ? (
                        <span className="absolute -right-1.5 -top-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                          {activeAdvancedFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <MapWorkflowStageStrip
                    workflowVisual={selectedHoleWorkflowVisual}
                    selectedHole={selectedHole}
                    canManageSelections={canManageSelections}
                    signingPhaseId={signingWorkflowPhaseId}
                    onSelectPhase={handleStageGateSelect}
                    selectedPhaseId={selectedWorkflowPhaseId}
                  />
                </div>
              </div>
              <div className="relative hidden items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:flex md:px-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Map canvas</div>
                  <div className="mt-1 text-lg font-semibold text-white">Hole collars and mapped assets</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-300">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
                    onClick={() => setShowAttributesDrawer(true)}
                  >
                    <AttributesIcon className="h-[18px] w-[18px]" />
                    <span>Attributes</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-300/18 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                    onClick={() => openCoreTasksPage(selectedHole)}
                    disabled={!selectedHole}
                  >
                    <CoreTasksIcon className="h-[18px] w-[18px]" />
                    <span>Core tasks</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Open filters"
                    title="Open filters"
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-100 shadow-[0_12px_28px_rgba(2,6,23,0.22)] transition hover:bg-white/[0.1]"
                    onClick={() => setShowAdvancedFilters(true)}
                  >
                    <FilterIcon className="h-[18px] w-[18px] text-cyan-200" />
                    {activeAdvancedFilterCount ? (
                      <span className="absolute -right-1.5 -top-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                        {activeAdvancedFilterCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label={isMapFullscreen ? "Exit full screen map" : "Open full screen map"}
                    title={isMapFullscreen ? "Exit full screen map" : "Open full screen map"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-100 shadow-[0_12px_28px_rgba(2,6,23,0.22)] transition hover:bg-white/[0.1]"
                    onClick={() => {
                      void toggleMapFullscreen();
                    }}
                  >
                    {isMapFullscreen ? <FullscreenExitIcon className="h-[18px] w-[18px]" /> : <FullscreenEnterIcon className="h-[18px] w-[18px]" />}
                  </button>
                  {activeAdvancedFilterCount ? (
                    <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
                      {activeAdvancedFilterCount} filter{activeAdvancedFilterCount === 1 ? "" : "s"} active
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-3 right-3 z-20 md:bottom-4 md:right-4">
                <div className="pointer-events-auto flex flex-col items-end gap-2">
                  {showLegend ? <HoleStateLegend /> : null}
                  <button
                    type="button"
                    aria-label={showLegend ? "Hide map legend" : "Show map legend"}
                    title={showLegend ? "Hide map legend" : "Show map legend"}
                    onClick={() => setShowLegend((current) => !current)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/82 text-slate-100 shadow-[0_18px_42px_rgba(2,6,23,0.3)] transition hover:bg-slate-900/92"
                  >
                    <LegendIcon className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
              {showCreateProjectPrompt ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 md:p-6">
                  <div className="pointer-events-auto w-full max-w-xl rounded-[30px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl md:p-5">
                    <EmptyProjectPrompt />
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                aria-label={isMapFullscreen ? "Exit full screen map" : "Open full screen map"}
                title={isMapFullscreen ? "Exit full screen map" : "Open full screen map"}
                className="absolute right-3 top-3 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/82 text-slate-100 shadow-[0_18px_42px_rgba(2,6,23,0.3)] transition hover:bg-slate-900/92 md:hidden"
                onClick={() => {
                  void toggleMapFullscreen();
                }}
              >
                {isMapFullscreen ? <FullscreenExitIcon className="h-[18px] w-[18px]" /> : <FullscreenEnterIcon className="h-[18px] w-[18px]" />}
              </button>
              {createPlacementActive && !showCreatePanel ? (
                <div className="pointer-events-none absolute inset-x-3 top-20 z-20 flex justify-center md:inset-x-4 md:top-24">
                  <div className="rounded-full border border-cyan-300/20 bg-slate-950/82 px-4 py-2 text-xs font-medium tracking-[0.16em] text-cyan-100 shadow-[0_18px_48px_rgba(2,6,23,0.42)] backdrop-blur-xl">
                    Click a free point on the map to place your new item
                  </div>
                </div>
              ) : null}
              {moveSelection ? (
                <div className="pointer-events-none absolute inset-x-3 top-20 z-20 flex justify-center md:inset-x-4 md:top-24">
                  <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-orange-300/25 bg-slate-950/88 px-4 py-2 text-xs font-medium tracking-[0.14em] text-orange-100 shadow-[0_18px_48px_rgba(2,6,23,0.42)] backdrop-blur-xl">
                    <span>{savingMoveSelection ? `Moving ${moveSelection.label}...` : `Click a free point to move ${moveSelection.label}`}</span>
                    <button
                      type="button"
                      onClick={cancelMoveSelection}
                      disabled={savingMoveSelection}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-slate-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {proposalPlacementSelection ? (
                <div className="pointer-events-none absolute inset-x-3 top-20 z-20 flex justify-center md:inset-x-4 md:top-24">
                  <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-cyan-300/25 bg-slate-950/88 px-4 py-2 text-xs font-medium tracking-[0.14em] text-cyan-100 shadow-[0_18px_48px_rgba(2,6,23,0.42)] backdrop-blur-xl">
                    <span>Click a free point to propose a new location for {proposalPlacementSelection.label}</span>
                    <button
                      type="button"
                      onClick={cancelProposalPlacementSelection}
                      className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-slate-100 transition hover:bg-white/[0.1]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {showCreatePanel ? (
                <MapCreateEntityPanel
                  entityType={createEntityType}
                  onEntityTypeChange={setCreateEntityType}
                  holeDraft={holeDraft}
                  assetDraft={assetDraft}
                  onHoleDraftChange={setHoleDraft}
                  onAssetDraftChange={setAssetDraft}
                  projects={ownProjects}
                  assetTypes={assetTypes}
                  assetLocations={assetLocations}
                  saving={savingCreateEntity}
                  onClose={closeCreatePanel}
                  onSave={() => {
                    void saveCreateEntity();
                  }}
                />
              ) : null}
              <div className="relative">
                <div ref={mapContainerRef} className={isMapFullscreen ? "h-[100svh] min-h-[100svh] w-full max-w-full" : "h-[58svh] min-h-[400px] w-full max-w-full md:h-[58vh] md:min-h-[480px]"} />
                {(canManageSelections || (canOpenDemoSchematic && activeMapSelection?.entityType === "hole")) && activeMapSelection?.entity && !showCreatePanel && !createPlacementActive && !moveSelection && !proposalPlacementSelection ? (
                  <MapSelectionActionDock
                    entityType={activeMapSelection.entityType}
                    entity={activeMapSelection.entity}
                    pendingProposal={activeMapSelectionPendingProposal}
                    mobile={isMobileViewport}
                    onAdd={canManageSelections && projectScope === "own" && !showCreateProjectPrompt ? () => openCreatePanel(createEntityType) : null}
                    onMove={canManageSelections ? () => requestMoveSelection(activeMapSelection.entityType, activeMapSelection.entity) : null}
                    onDuplicate={canManageSelections ? () => openDuplicateSelection(activeMapSelection.entityType, activeMapSelection.entity) : null}
                    onPropose={canManageSelections ? () => requestProposalLocation(activeMapSelection.entityType, activeMapSelection.entity) : null}
                    onReview={canManageSelections ? () => openProposalReview(activeMapSelection.entityType, activeMapSelection.entity) : null}
                    onOpenSchematic={() => {
                      if (activeMapSelection.entityType === "hole") {
                        void openSchematicModal(activeMapSelection.entity);
                      }
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="xl:hidden min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-4 py-4">
                <div className="flex flex-col items-start gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Navigator</div>
                    <div className="mt-1 text-lg font-semibold text-white">{mobileSelectionTitle}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1.5">
                    <button
                      type="button"
                      className={`min-w-0 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "holes" ? "bg-amber-300 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setMobilePanelTab("holes");
                        setNavigatorTab("holes");
                      }}
                    >
                      Holes
                    </button>
                    <button
                      type="button"
                      className={`min-w-0 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "assets" ? "bg-rose-300 text-slate-950 shadow-[0_12px_28px_rgba(244,114,182,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setMobilePanelTab("assets");
                        setNavigatorTab("assets");
                      }}
                    >
                      Assets
                    </button>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/45 p-1.5">
                    <button
                      type="button"
                      className={`min-w-0 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)]" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setProjectScope("own");
                        setProjectFilter("");
                      }}
                    >
                      My Projects
                    </button>
                    <button
                      type="button"
                      className={`min-w-0 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.25)]" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setProjectScope("shared");
                        setProjectFilter("");
                      }}
                    >
                      Client Shared
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="Open filters"
                    title="Open filters"
                    className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/55 text-sm font-medium text-slate-100 transition hover:bg-slate-900/70"
                    onClick={() => setShowAdvancedFilters(true)}
                  >
                    <FilterIcon className="h-[18px] w-[18px] text-cyan-200" />
                    {activeAdvancedFilterCount ? (
                      <span className="absolute -right-1.5 -top-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                        {activeAdvancedFilterCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>

              {mobilePanelTab === "holes" ? (
                <ProjectAccordionList
                  loading={loading}
                  projects={filteredProjects}
                  expandedProjects={expandedProjects}
                  onToggleProject={toggleProjectExpanded}
                  selectedHoleId={selectedHole?.id || ""}
                  onSelectHole={focusHole}
                  compact
                />
              ) : mobilePanelTab === "assets" ? (
                <>
                  <AssetTypeNavigatorFilter
                    value={assetNavigatorTypeFilter}
                    onChange={setAssetNavigatorTypeFilter}
                    options={assetTypeOptions}
                    resultCount={visibleAssets.length}
                    compact
                  />
                  <AssetAccordionList
                    loading={loading}
                    projects={filteredAssetProjects}
                    expandedProjects={expandedAssetProjects}
                    onToggleProject={toggleAssetProjectExpanded}
                    selectedAssetId={selectedAsset?.id || ""}
                    onSelectAsset={focusAsset}
                    activeTypeLabel={activeAssetNavigatorTypeLabel}
                    compact
                  />
                </>
              ) : null}
            </div>

          </div>
        </section>
      </div>

      <AttributesDrawer
        open={showAttributesDrawer}
        onClose={() => setShowAttributesDrawer(false)}
        title={attributesTitle}
        subtitle={attributesSubtitle}
      >
        {attributesTab === "holes" ? (
          <HoleAttributesPanel
            selectedHole={selectedHole}
            canManage={canManageSelections}
            onEdit={openHoleEditor}
            onDelete={deleteSelectedHole}
            deleting={deletingAdminAction && navigatorTab === "holes"}
            mobile={isMobileViewport}
          />
        ) : (
          <AssetAttributesPanel
            selectedAsset={selectedAsset}
            canManage={canManageSelections}
            onEdit={openAssetEditor}
            onDelete={deleteSelectedAsset}
            deleting={deletingAdminAction && navigatorTab === "assets"}
            mobile={isMobileViewport}
          />
        )}
      </AttributesDrawer>

      <HoleEditorModal
        hole={editingHole}
        projects={ownProjects}
        saving={savingAdminAction}
        onClose={closeHoleEditor}
        onSave={saveHoleEdits}
      />

      <AssetEditorModal
        asset={editingAsset}
        projects={ownProjects}
        assetTypes={assetTypes}
        assetLocations={assetLocations}
        saving={savingAdminAction}
        onClose={closeAssetEditor}
        onSave={saveAssetEdits}
      />

      <HoleSchematicModal
        hole={schematicHole}
        loading={schematicLoading}
        error={schematicError}
        geologyRows={schematicGeologyRows}
        constructionRows={schematicConstructionRows}
        annulusRows={schematicAnnulusRows}
        lithById={schematicLithById}
        constructionById={schematicConstructionById}
        annulusById={schematicAnnulusById}
        onClose={closeSchematicModal}
      />

      <MapEntityDuplicateModal
        selection={duplicateSelection}
        saving={duplicatingEntity}
        onClose={() => (!duplicatingEntity ? setDuplicateSelection(null) : null)}
        onChangeName={(value) => setDuplicateSelection((current) => (current ? { ...current, newName: value } : current))}
        onSubmit={submitDuplicateSelection}
      />

      <MapLocationProposalModal
        draft={proposalDraft}
        saving={savingProposalDraft}
        onClose={() => (!savingProposalDraft ? setProposalDraft(null) : null)}
        onChangeNote={(value) => setProposalDraft((current) => (current ? { ...current, note: value } : current))}
        onSubmit={submitProposalDraft}
      />

      <MapLocationProposalReviewModal
        review={proposalReview}
        saving={savingProposalReview}
        onClose={() => (!savingProposalReview ? setProposalReview(null) : null)}
        onChangeReviewNote={(value) => setProposalReview((current) => (current ? { ...current, reviewNote: value } : current))}
        onApprove={() => submitProposalReview("approved")}
        onReject={() => submitProposalReview("rejected")}
      />

      <MapWorkflowPhaseDrawer
        open={!!selectedWorkflowPhase}
        selectedHole={selectedHole}
        phase={selectedWorkflowPhase}
        workflowVisual={selectedHoleWorkflowVisual}
        canManageSelections={canManageSelections}
        signingPhaseId={signingWorkflowPhaseId}
        signingStepId={signingWorkflowStepId}
        onClose={() => setSelectedWorkflowPhaseId("")}
        onToggleStep={handleWorkflowStepToggle}
      />

      <AdvancedFilterDrawer open={showAdvancedFilters} onClose={() => setShowAdvancedFilters(false)}>
        <AdvancedFilterPanel
          projectScope={projectScope}
          projectFilter={projectFilter}
          projectOptions={projectOptions}
          totalProjects={totalProjects}
          filters={advancedFilters}
          activeFilterCount={activeAdvancedFilterCount}
          descriptorOptions={descriptorOptions}
          holeStateOptions={holeStateOptions}
          holeCompletionStatusOptions={holeCompletionStatusOptions}
          assetStatusOptions={assetStatusOptions}
          assetTypeOptions={assetTypeOptions}
          assetLocationOptions={assetLocationOptions}
          onProjectScopeChange={(scope) => {
            setProjectScope(scope);
            setProjectFilter("");
          }}
          onProjectFilterChange={setProjectFilter}
          onChange={updateAdvancedFilter}
          onClear={clearAdvancedFilters}
          onClose={() => setShowAdvancedFilters(false)}
          containerClassName="mt-4 border-0 bg-transparent p-0 shadow-none backdrop-blur-none"
        />
      </AdvancedFilterDrawer>
    </div>
  );
}
