"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";
import {
  attachHoleDescriptors,
  fetchHoleDescriptorAssignments,
  fetchOrgHoleDescriptors,
  replaceHoleDescriptorAssignments,
  replaceManyHoleDescriptorAssignments,
} from "@/lib/holeDescriptors";
import { EditIconButton, DeleteIconButton } from "@/app/components/ActionIconButton";
import { DEFAULT_TASK_TYPE_DEFS, fetchOrgTaskTypes } from "@/lib/taskTypes";
import {
  WORKFLOW_STATUS_OPTIONS,
  formatWorkflowPhaseLabel,
  formatWorkflowSubstageLabel,
  getWorkflowAssignmentLabel,
  getWorkflowBadgeStyle,
  getWorkflowPhaseOptions,
  getWorkflowStatusMeta,
  getWorkflowSubstageOptions,
  normalizeWorkflows,
  resolveHierarchicalWorkflowSelection,
} from "@/lib/workflows";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";
import HoleLocationPickerModal from "./HoleLocationPickerModal";

const STATE_OPTIONS = ["proposed", "in_progress", "drilled"];
const DIAMETER_OPTIONS = ["", "NQ", "HQ", "PQ", "Other"];
const COLLAR_SOURCE_OPTIONS = ["", "gps", "survey", "estimated", "imported", "map_picked"];
const COMPLETION_STATUS_OPTIONS = ["", "completed", "abandoned", "suspended"];
const BULK_KEEP_VALUE = "__keep__";

function humanizeLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toNumOrNull(value) {
  if (value === "" || value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toTextOrNull(value) {
  const text = String(value || "").trim();
  return text || null;
}

function toIsoOrNull(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateValue = new Date(text);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return "";
  const pad = (numberValue) => String(numberValue).padStart(2, "0");
  return `${dateValue.getFullYear()}-${pad(dateValue.getMonth() + 1)}-${pad(dateValue.getDate())}T${pad(dateValue.getHours())}:${pad(dateValue.getMinutes())}`;
}

function formatMeters(value) {
  if (value == null || value === "") return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return `${numberValue.toFixed(1)} m`;
}

function formatDegrees(value) {
  if (value == null || value === "") return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return `${numberValue.toFixed(1)}°`;
}

function resolveDefaultProjectId(projects, preferredProjectId = "") {
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }
  if (projects.length === 1) return projects[0].id;
  return "";
}

function formatProjectCrs(project) {
  const selectedProjectCrs = getAustralianProjectCrsByCode(project?.coordinate_crs_code) || null;
  if (selectedProjectCrs) return `${selectedProjectCrs.name} (${selectedProjectCrs.code})`;
  if (project?.coordinate_crs_code || project?.coordinate_crs_name) {
    return project.coordinate_crs_name || project.coordinate_crs_code;
  }
  return "Not set on project yet";
}

function formatDescriptorSummary(descriptors) {
  if (!descriptors?.length) return "No descriptors assigned";
  return descriptors.map((descriptor) => descriptor.name).join(", ");
}

function getStateMeta(state) {
  if (state === "drilled") return { label: "Drilled", className: "bg-cyan-300/15 text-cyan-100 border-cyan-300/20" };
  if (state === "in_progress") return { label: "In Progress", className: "bg-amber-300/15 text-amber-100 border-amber-300/20" };
  return { label: "Proposed", className: "bg-slate-200/10 text-slate-200 border-white/10" };
}

function getWorkflowMeta(status) {
  if (status === "complete") return { label: "Plan Complete", className: "bg-emerald-400/15 text-emerald-100 border-emerald-300/20" };
  if (status === "in_progress") return { label: "Plan Active", className: "bg-fuchsia-400/15 text-fuchsia-100 border-fuchsia-300/20" };
  return { label: "Planned", className: "bg-orange-400/15 text-orange-100 border-orange-300/20" };
}

function createEmptyForm(projectId = "") {
  return {
    hole_id: "",
    depth: "",
    planned_depth: "",
    water_level_m: "",
    azimuth: "",
    dip: "",
    collar_longitude: "",
    collar_latitude: "",
    collar_easting: "",
    collar_northing: "",
    collar_elevation_m: "",
    collar_source: "",
    started_at: "",
    completed_at: "",
    completion_status: "",
    completion_notes: "",
    state: "proposed",
    current_workflow_id: "",
    current_workflow_phase_id: "",
    current_workflow_substage_id: "",
    current_workflow_status_key: "not_started",
    drilling_diameter: "",
    drilling_contractor: "",
    descriptor_ids: [],
    project_id: projectId,
  };
}

function DescriptorMultiSelect({ options, value, onChange, disabled = false, emptyText = "No descriptors configured yet." }) {
  const selectedIds = new Set(value || []);

  if (!options.length) {
    return <div className="mt-1 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-slate-400">{emptyText}</div>;
  }

  return (
    <div className="mt-1 max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      {options.map((descriptor) => {
        const active = selectedIds.has(descriptor.id);
        return (
          <label
            key={descriptor.id}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition",
              active ? "border-cyan-300/25 bg-cyan-300/10" : "border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/[0.04]",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300"
              checked={active}
              disabled={disabled}
              onChange={() => {
                if (disabled) return;
                const next = active ? (value || []).filter((id) => id !== descriptor.id) : [...(value || []), descriptor.id];
                onChange(next);
              }}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">{descriptor.name}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {descriptor.key}
                {descriptor.category ? ` • ${descriptor.category}` : ""}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export default function HoleDetailsTab({ projectScope = "own" }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [holes, setHoles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [holeWorkflows, setHoleWorkflows] = useState([]);
  const [availableDescriptors, setAvailableDescriptors] = useState([]);
  const [holeStatus, setHoleStatus] = useState({});
  const [taskMeta, setTaskMeta] = useState(
    Object.fromEntries(DEFAULT_TASK_TYPE_DEFS.map((task) => [task.key, { label: task.name, color: task.color || "#64748b" }]))
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [diameterFilter, setDiameterFilter] = useState("");
  const [descriptorFilter, setDescriptorFilter] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState({});

  const [selectedHole, setSelectedHole] = useState(null);
  const [selectedHoleIds, setSelectedHoleIds] = useState([]);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [form, setForm] = useState(createEmptyForm());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    project_id: BULK_KEEP_VALUE,
    state: BULK_KEEP_VALUE,
    drilling_diameter: BULK_KEEP_VALUE,
    drilling_contractor_action: "keep",
    drilling_contractor: "",
    descriptor_action: "keep",
    descriptor_ids: [],
  });

  const [intervals, setIntervals] = useState({});
  const [intervalSaveState, setIntervalSaveState] = useState("idle");
  const [intervalSaveMessage, setIntervalSaveMessage] = useState("Select a hole to unlock interval planning.");

  const suppressIntervalAutosaveRef = useRef(true);
  const autosaveTimerRef = useRef(null);
  const lastSavedIntervalsRef = useRef("");

  const taskTypeKeys = useMemo(() => Object.keys(taskMeta), [taskMeta]);
  const emptyIntervals = useMemo(
    () => taskTypeKeys.reduce((accumulator, taskKey) => ({ ...accumulator, [taskKey]: [] }), {}),
    [taskTypeKeys]
  );

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!portalMounted || !selectedHole) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalMounted, selectedHole]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const tasks = await fetchOrgTaskTypes(supabase, orgId);
        if (!active) return;
        setTaskMeta(
          Object.fromEntries(
            tasks.map((task, index) => [
              task.key,
              {
                label: task.name || humanizeLabel(task.key),
                color: task.color || DEFAULT_TASK_TYPE_DEFS[index % DEFAULT_TASK_TYPE_DEFS.length]?.color || "#64748b",
              },
            ])
          )
        );
      } catch (error) {
        console.error("Could not load task types for Test tab", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [orgId, supabase]);

  useEffect(() => {
    let active = true;

    if (!orgId || projectScope === "shared") {
      setAvailableDescriptors([]);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const rows = await fetchOrgHoleDescriptors(supabase, orgId);
        if (!active) return;
        setAvailableDescriptors(rows);
      } catch (error) {
        if (!active) return;
        setAvailableDescriptors([]);
        toast.error(error?.message || "Failed to load hole descriptors");
      }
    })();

    return () => {
      active = false;
    };
  }, [orgId, projectScope, supabase]);

  useEffect(() => {
    if (!orgId || projectScope === "shared") {
      setHoleWorkflows([]);
      return undefined;
    }

    let active = true;

    (async () => {
      const [workflowRes, phaseRes, substageRes] = await Promise.all([
        supabase
          .from("workflow_definitions")
          .select("id, organization_id, entity_type, key, name, description, color, sort_order, is_active, created_at")
          .eq("organization_id", orgId)
          .eq("entity_type", "hole"),
        supabase
          .from("workflow_phase_definitions")
          .select("id, workflow_id, phase_index, name, description, created_at"),
        supabase
          .from("workflow_substage_definitions")
          .select("id, workflow_phase_id, substage_index, name, description, created_at"),
      ]);

      if (!active) return;

      if (workflowRes.error) {
        toast.error(workflowRes.error.message || "Failed to load hole workflows");
        setHoleWorkflows([]);
        return;
      }

      if (phaseRes.error) {
        toast.error(phaseRes.error.message || "Failed to load workflow phases");
        setHoleWorkflows([]);
        return;
      }

      if (substageRes.error) {
        toast.error(substageRes.error.message || "Failed to load workflow substages");
        setHoleWorkflows([]);
        return;
      }

      setHoleWorkflows(normalizeWorkflows(workflowRes.data || [], phaseRes.data || [], substageRes.data || []));
    })();

    return () => {
      active = false;
    };
  }, [orgId, projectScope, supabase]);

  const labelForTask = (taskKey) => taskMeta[taskKey]?.label || humanizeLabel(taskKey);
  const colorForTask = (taskKey) => taskMeta[taskKey]?.color || "#64748b";

  const classifyHole = (hole) => {
    const status = holeStatus[hole.id] || {};
    if (status.hasPlanned) {
      if (status.complete) return "complete";
      if (status.hasProgress) return "in_progress";
      return "not_started";
    }
    return status.hasProgress ? "in_progress" : "not_started";
  };

  const loadWorkflowStatus = async (holeIds) => {
    if (!holeIds.length) {
      setHoleStatus({});
      return {};
    }

    const [planRes, progressRes] = await Promise.all([
      supabase.from("hole_task_intervals").select("hole_id, task_type, from_m, to_m").in("hole_id", holeIds),
      supabase.from("hole_task_progress").select("hole_id, task_type, from_m, to_m").in("hole_id", holeIds),
    ]);

    if (planRes.error) throw planRes.error;
    if (progressRes.error) throw progressRes.error;

    const plannedRows = planRes.data || [];
    const progressRows = progressRes.data || [];
    const plannedByHole = {};
    const progressByHole = {};

    plannedRows.forEach((row) => {
      (plannedByHole[row.hole_id] ||= []).push(row);
    });
    progressRows.forEach((row) => {
      (progressByHole[row.hole_id] ||= []).push(row);
    });

    const nextStatus = {};
    holeIds.forEach((holeId) => {
      const planned = plannedByHole[holeId] || [];
      const progress = progressByHole[holeId] || [];
      const progressByTask = {};

      progress.forEach((row) => {
        (progressByTask[row.task_type] ||= []).push(row);
      });

      const complete = planned.length
        ? planned.every((planRow) => {
            const overlaps = (progressByTask[planRow.task_type] || [])
              .filter(
                (row) =>
                  Math.max(0, Math.min(Number(planRow.to_m), Number(row.to_m)) - Math.max(Number(planRow.from_m), Number(row.from_m))) > 0
              )
              .sort((left, right) => Number(left.from_m) - Number(right.from_m));

            let cursor = Number(planRow.from_m);
            for (const row of overlaps) {
              if (Number(row.from_m) > cursor) break;
              if (Number(row.to_m) > cursor) cursor = Number(row.to_m);
            }
            return cursor >= Number(planRow.to_m);
          })
        : false;

      nextStatus[holeId] = {
        hasPlanned: planned.length > 0,
        complete,
        hasProgress: progress.length > 0,
      };
    });

    setHoleStatus(nextStatus);
    return nextStatus;
  };

  const loadData = async () => {
    if (!orgId) {
      setHoles([]);
      setProjects([]);
      setHoleStatus({});
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      let nextHoles = [];
      let nextProjects = [];

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
                const relationship = row.relationship;
                if (!relationship) return false;
                const status = String(relationship.status || "");
                const accepted = status === "active" || status === "accepted" || !!relationship.accepted_at;
                const allowed = !!relationship.permissions?.share_project_details;
                return relationship.vendor_organization_id === orgId && accepted && allowed;
              })
              .map((row) => row.project_id)
              .filter(Boolean)
          )
        );

        if (!sharedProjectIds.length) {
          setHoles([]);
          setProjects([]);
          setHoleStatus({});
          setLoading(false);
          return [];
        }

        const { data: sharedHoles, error: holesErr } = await supabase
          .from("holes")
          .select(
              "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,current_workflow_id,current_workflow_phase_id,current_workflow_substage_id,current_workflow_status_key,drilling_diameter,drilling_contractor,project_id,created_at,organization_id,projects(name,coordinate_crs_code,coordinate_crs_name),current_workflow_phase:workflow_phase_definitions!holes_current_workflow_phase_id_fkey(id,name,phase_index),current_workflow_substage:workflow_substage_definitions!holes_current_workflow_substage_id_fkey(id,name,substage_index)"
          )
          .in("project_id", sharedProjectIds)
          .neq("organization_id", orgId)
          .order("created_at", { ascending: false });

        if (holesErr) throw holesErr;

        const projectMap = new Map();
        nextHoles = (sharedHoles || []).map((hole) => {
          if (hole.project_id && hole.projects?.name) projectMap.set(hole.project_id, hole.projects);
          const derived = deriveHoleCoordinates({
            collarLongitude: hole.collar_longitude ?? null,
            collarLatitude: hole.collar_latitude ?? null,
            collarEasting: hole.collar_easting ?? null,
            collarNorthing: hole.collar_northing ?? null,
            projectCrsCode: hole.projects?.coordinate_crs_code || null,
          });

          return {
            ...hole,
            collar_longitude: derived.collarLongitude,
            collar_latitude: derived.collarLatitude,
            coordinate_derived: derived.coordinateDerived,
          };
        });
        nextProjects = Array.from(projectMap.entries())
          .map(([id, project]) => ({ id, ...project }))
          .sort((left, right) => left.name.localeCompare(right.name));
      } else {
        const [holesRes, projectsRes] = await Promise.all([
          supabase
            .from("holes")
            .select(
              "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,current_workflow_id,current_workflow_phase_id,current_workflow_substage_id,current_workflow_status_key,drilling_diameter,drilling_contractor,project_id,created_at,projects(name,coordinate_crs_code,coordinate_crs_name),current_workflow_phase:workflow_phase_definitions!holes_current_workflow_phase_id_fkey(id,name,phase_index),current_workflow_substage:workflow_substage_definitions!holes_current_workflow_substage_id_fkey(id,name,substage_index)"
            )
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase
            .from("projects")
            .select("id,name,coordinate_crs_code,coordinate_crs_name")
            .eq("organization_id", orgId)
            .order("name", { ascending: true }),
        ]);

        if (holesRes.error) throw holesRes.error;
        if (projectsRes.error) throw projectsRes.error;

        nextHoles = (holesRes.data || []).map((hole) => {
          const derived = deriveHoleCoordinates({
            collarLongitude: hole.collar_longitude ?? null,
            collarLatitude: hole.collar_latitude ?? null,
            collarEasting: hole.collar_easting ?? null,
            collarNorthing: hole.collar_northing ?? null,
            projectCrsCode: hole.projects?.coordinate_crs_code || null,
          });

          return {
            ...hole,
            collar_longitude: derived.collarLongitude,
            collar_latitude: derived.collarLatitude,
            coordinate_derived: derived.coordinateDerived,
          };
        });
        nextProjects = projectsRes.data || [];
      }

      const descriptorsByHole = await fetchHoleDescriptorAssignments(
        supabase,
        nextHoles.map((hole) => hole.id)
      );
      const holesWithDescriptors = attachHoleDescriptors(nextHoles, descriptorsByHole);

      setHoles(holesWithDescriptors);
      setProjects(nextProjects);
      await loadWorkflowStatus(holesWithDescriptors.map((hole) => hole.id));
      return holesWithDescriptors;
    } catch (error) {
      toast.error(error?.message || "Failed to load unified core planner");
      setHoles([]);
      setProjects([]);
      setHoleStatus({});
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [orgId, projectScope]);

  useEffect(() => {
    setProjectFilter("");
    setStateFilter("");
    setDiameterFilter("");
    setDescriptorFilter("");
    setSearch("");
    setSelectedHole(null);
    setSelectedHoleIds([]);
    setIsCreateMode(false);
    setShowBulkEdit(false);
    setIntervals(emptyIntervals);
    setIntervalSaveState("idle");
    setIntervalSaveMessage("Select a hole to unlock interval planning.");
  }, [projectScope, emptyIntervals]);

  useEffect(() => {
    const validIds = new Set((holes || []).map((hole) => hole.id));
    setSelectedHoleIds((current) => current.filter((id) => validIds.has(id)));
  }, [holes]);

  const filteredHoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (holes || []).filter((hole) => {
      if (projectFilter && hole.project_id !== projectFilter) return false;
      if (stateFilter && hole.state !== stateFilter) return false;
      if (diameterFilter && hole.drilling_diameter !== diameterFilter) return false;
      if (descriptorFilter && !(hole.descriptor_ids || []).includes(descriptorFilter)) return false;
      if (!term) return true;

      return [
        hole.hole_id,
        hole.projects?.name,
        hole.drilling_contractor,
        hole.state,
        hole.drilling_diameter,
        hole.descriptor_names_text,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [descriptorFilter, diameterFilter, holes, projectFilter, search, stateFilter]);

  const groupedFilteredHoles = useMemo(() => {
    const groups = new Map();

    for (const hole of filteredHoles) {
      const groupId = hole.project_id || "__unassigned__";
      const groupName = hole.projects?.name || "Unassigned holes";
      const existing = groups.get(groupId);

      if (existing) {
        existing.holes.push(hole);
        continue;
      }

      groups.set(groupId, {
        id: groupId,
        name: groupName,
        holes: [hole],
      });
    }

    return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredHoles]);

  useEffect(() => {
    setExpandedProjectIds((current) => {
      const next = {};

      for (const group of groupedFilteredHoles) {
        next[group.id] = current[group.id] ?? true;
      }

      return next;
    });
  }, [groupedFilteredHoles]);

  const descriptorFilterOptions = useMemo(() => {
    const descriptorMap = new Map();
    (holes || []).forEach((hole) => {
      (hole.descriptors || []).forEach((descriptor) => {
        if (!descriptorMap.has(descriptor.id)) descriptorMap.set(descriptor.id, descriptor);
      });
    });
    return Array.from(descriptorMap.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [holes]);

  const activeFilterCount = useMemo(
    () => [search.trim(), projectFilter, stateFilter, diameterFilter, descriptorFilter].filter(Boolean).length,
    [descriptorFilter, diameterFilter, projectFilter, search, stateFilter]
  );

  const headerStats = useMemo(() => {
    const counts = filteredHoles.reduce(
      (accumulator, hole) => {
        const status = classifyHole(hole);
        accumulator[status] += 1;
        return accumulator;
      },
      { complete: 0, in_progress: 0, not_started: 0 }
    );

    return [
      { label: "visible holes", value: loading ? "..." : filteredHoles.length },
      { label: "plan active", value: loading ? "..." : counts.in_progress },
      { label: "plan complete", value: loading ? "..." : counts.complete },
    ];
  }, [filteredHoles, loading]);

  const filteredHoleIds = useMemo(() => filteredHoles.map((hole) => hole.id), [filteredHoles]);

  const allFilteredSelected = useMemo(
    () => filteredHoleIds.length > 0 && filteredHoleIds.every((id) => selectedHoleIds.includes(id)),
    [filteredHoleIds, selectedHoleIds]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === (form.project_id || "")) || null,
    [projects, form.project_id]
  );

  const renderHoleCard = (hole) => {
    const workflowMeta = getWorkflowMeta(classifyHole(hole));
    const stateMeta = getStateMeta(hole.state);
    const isSelected = selectedHole?.id === hole.id;

    return (
      <div
        key={hole.id}
        role="button"
        tabIndex={0}
        onClick={() => openHole(hole)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openHole(hole);
          }
        }}
        className={[
          "group overflow-hidden rounded-[30px] border p-4 text-left shadow-[0_24px_80px_rgba(2,6,23,0.32)] transition-base focus:outline-none focus:ring-2 focus:ring-cyan-300/40 md:p-5",
          isSelected
            ? "border-cyan-300/35 bg-[linear-gradient(145deg,rgba(8,47,73,0.58),rgba(15,23,42,0.78),rgba(76,29,149,0.22))]"
            : "border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(15,23,42,0.65),rgba(30,41,59,0.52))] hover:border-white/20 hover:bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(8,47,73,0.58),rgba(30,41,59,0.6))]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{hole.hole_id}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${workflowMeta.className}`}>{workflowMeta.label}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${stateMeta.className}`}>{stateMeta.label}</span>
            </div>
            <div className="mt-2 text-sm text-slate-300">{hole.projects?.name || "No project assigned"}</div>
            <div className="mt-1 text-xs text-slate-400">{hole.drilling_contractor || "No contractor assigned"}</div>
            {hole.descriptors?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {hole.descriptors.slice(0, 4).map((descriptor) => (
                  <span key={descriptor.id} className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                    {descriptor.name}
                  </span>
                ))}
                {hole.descriptors.length > 4 ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">+{hole.descriptors.length - 4} more</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
            {projectScope !== "shared" ? (
              <button
                type="button"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${selectedHoleIds.includes(hole.id) ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                aria-label={selectedHoleIds.includes(hole.id) ? `Unselect ${hole.hole_id}` : `Select ${hole.hole_id}`}
                title={selectedHoleIds.includes(hole.id) ? "Unselect" : "Select"}
                onClick={() => toggleHoleSelection(hole.id)}
              >
                {selectedHoleIds.includes(hole.id) ? "✓" : "+"}
              </button>
            ) : null}
            <EditIconButton onClick={() => openHole(hole)} />
            <DeleteIconButton disabled={projectScope === "shared"} onClick={() => void deleteHole(hole.id)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Depth</div>
            <div className="mt-1 font-medium">{formatMeters(hole.depth)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Planned</div>
            <div className="mt-1 font-medium">{formatMeters(hole.planned_depth)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Azimuth</div>
            <div className="mt-1 font-medium">{formatDegrees(hole.azimuth)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Diameter</div>
            <div className="mt-1 font-medium">{hole.drilling_diameter || "-"}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => viewHoleInMap(hole.id)}
          >
            View in Map
          </button>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => viewHoleSchematic(hole.id)}
          >
            View Schematic
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>{hole.coordinate_derived ? "Coordinates derived from project CRS" : "Using stored WGS84 collar coordinates"}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300 transition-base group-hover:border-cyan-300/20 group-hover:text-cyan-100">
            Open planner
          </span>
        </div>
      </div>
    );
  };

  const intervalSummary = useMemo(() => {
    const allRows = taskTypeKeys.flatMap((taskKey) => (intervals[taskKey] || []).map((row) => ({ ...row, taskKey })));
    const validRows = allRows.filter((row) => {
      const fromValue = Number(row.from_m);
      const toValue = Number(row.to_m);
      return Number.isFinite(fromValue) && Number.isFinite(toValue) && toValue > fromValue;
    });

    const totalMeters = validRows.reduce((sum, row) => sum + (Number(row.to_m) - Number(row.from_m)), 0);
    return {
      rowCount: validRows.length,
      totalMeters,
    };
  }, [intervals, taskTypeKeys]);

  const serialiseIntervals = (value) =>
    JSON.stringify(
      taskTypeKeys.map((taskKey) => [
        taskKey,
        (value?.[taskKey] || []).map((row) => ({
          from_m: String(row.from_m ?? "").trim(),
          to_m: String(row.to_m ?? "").trim(),
        })),
      ])
    );

  const assessIntervals = (value) => {
    const rows = [];
    let hasIncompleteDraft = false;
    let hasInvalidRange = false;

    for (const taskKey of taskTypeKeys) {
      for (const row of value?.[taskKey] || []) {
        const rawFrom = String(row.from_m ?? "").trim();
        const rawTo = String(row.to_m ?? "").trim();
        const isBlank = rawFrom === "" && rawTo === "";
        if (isBlank) continue;

        if (rawFrom === "" || rawTo === "") {
          hasIncompleteDraft = true;
          continue;
        }

        const fromValue = Number(rawFrom);
        const toValue = Number(rawTo);
        if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || toValue <= fromValue) {
          hasInvalidRange = true;
          continue;
        }

        rows.push({
          hole_id: selectedHole?.id,
          task_type: taskKey,
          from_m: fromValue,
          to_m: toValue,
        });
      }
    }

    return { rows, hasIncompleteDraft, hasInvalidRange };
  };

  useEffect(() => {
    if (!selectedHole?.id) {
      suppressIntervalAutosaveRef.current = true;
      lastSavedIntervalsRef.current = "";
      setIntervals(emptyIntervals);
      setIntervalSaveState("idle");
      setIntervalSaveMessage(isCreateMode ? "Save the new hole first, then add intervals." : "Select a hole to unlock interval planning.");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("hole_task_intervals")
        .select("id, task_type, from_m, to_m")
        .eq("hole_id", selectedHole.id)
        .order("from_m", { ascending: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      const grouped = taskTypeKeys.reduce((accumulator, taskKey) => ({ ...accumulator, [taskKey]: [] }), {});
      for (const row of data || []) {
        if (!grouped[row.task_type]) grouped[row.task_type] = [];
        grouped[row.task_type].push({ id: row.id, from_m: row.from_m, to_m: row.to_m });
      }

      suppressIntervalAutosaveRef.current = true;
      lastSavedIntervalsRef.current = serialiseIntervals(grouped);
      setIntervals(grouped);
      setIntervalSaveState("saved");
      setIntervalSaveMessage((data || []).length ? "All interval changes saved." : "No planned intervals yet.");
    })();
  }, [selectedHole?.id, supabase, taskTypeKeys, emptyIntervals, isCreateMode]);

  useEffect(() => {
    if (!selectedHole?.id) return undefined;

    if (suppressIntervalAutosaveRef.current) {
      suppressIntervalAutosaveRef.current = false;
      return undefined;
    }

    const snapshot = serialiseIntervals(intervals);
    if (snapshot === lastSavedIntervalsRef.current) {
      setIntervalSaveState("saved");
      setIntervalSaveMessage("All interval changes saved.");
      return undefined;
    }

    const { hasIncompleteDraft, hasInvalidRange } = assessIntervals(intervals);
    if (hasIncompleteDraft) {
      setIntervalSaveState("draft");
      setIntervalSaveMessage("Complete both From and To before a new interval can save.");
      return undefined;
    }

    if (hasInvalidRange) {
      setIntervalSaveState("error");
      setIntervalSaveMessage("Each interval needs numeric values and To must be greater than From.");
      return undefined;
    }

    setIntervalSaveState("saving");
    setIntervalSaveMessage("Saving interval changes...");

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void saveIntervals({ silent: true, snapshot });
    }, 700);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [intervals, selectedHole?.id, taskTypeKeys]);

  const openHole = (hole) => {
    setIsCreateMode(false);
    setSelectedHole(hole);
    setForm({
      hole_id: hole.hole_id || "",
      depth: hole.depth ?? "",
      planned_depth: hole.planned_depth ?? "",
      water_level_m: hole.water_level_m ?? "",
      azimuth: hole.azimuth ?? "",
      dip: hole.dip ?? "",
      collar_longitude: hole.collar_longitude ?? "",
      collar_latitude: hole.collar_latitude ?? "",
      collar_easting: hole.collar_easting ?? "",
      collar_northing: hole.collar_northing ?? "",
      collar_elevation_m: hole.collar_elevation_m ?? "",
      collar_source: hole.collar_source || "",
      started_at: toDateTimeLocal(hole.started_at),
      completed_at: toDateTimeLocal(hole.completed_at),
      completion_status: hole.completion_status || "",
      completion_notes: hole.completion_notes || "",
      state: hole.state || "proposed",
      current_workflow_id: hole.current_workflow_id || "",
      current_workflow_phase_id: hole.current_workflow_phase_id || "",
      current_workflow_substage_id: hole.current_workflow_substage_id || "",
      current_workflow_status_key: hole.current_workflow_status_key || "not_started",
      drilling_diameter: hole.drilling_diameter || "",
      drilling_contractor: hole.drilling_contractor || "",
      descriptor_ids: hole.descriptor_ids || [],
      project_id: hole.project_id || "",
    });
    setIntervalSaveState("idle");
    setIntervalSaveMessage("Loading planned intervals...");
  };

  const openCreateHole = () => {
    if (projectScope === "shared") return;
    setIsCreateMode(true);
    setSelectedHole({ id: null });
    setShowLocationPicker(false);
    setForm(createEmptyForm(resolveDefaultProjectId(projects, projectFilter)));
    setIntervals(emptyIntervals);
    setIntervalSaveState("idle");
    setIntervalSaveMessage("Save the new hole first, then add intervals.");
  };

  const closeHole = () => {
    if (saving || deleting) return;
    setShowLocationPicker(false);
    setSelectedHole(null);
    setIsCreateMode(false);
  };

  const openLocationPicker = () => {
    if (!form.project_id) {
      toast.error("Select a project first");
      return;
    }

    setShowLocationPicker(true);
  };

  const addInterval = (taskKey) => {
    setIntervals((current) => ({
      ...current,
      [taskKey]: [...(current[taskKey] || []), { from_m: "", to_m: "" }],
    }));
  };

  const changeInterval = (taskKey, index, field, value) => {
    setIntervals((current) => {
      const nextRows = [...(current[taskKey] || [])];
      nextRows[index] = { ...nextRows[index], [field]: value };
      return { ...current, [taskKey]: nextRows };
    });
  };

  const removeInterval = (taskKey, index) => {
    setIntervals((current) => {
      const nextRows = [...(current[taskKey] || [])];
      nextRows.splice(index, 1);
      return { ...current, [taskKey]: nextRows };
    });
  };

  const saveIntervals = async ({ silent = false, snapshot = null } = {}) => {
    if (!selectedHole?.id) {
      if (!silent) toast.error("Save the hole before planning intervals");
      return false;
    }

    const currentSnapshot = snapshot || serialiseIntervals(intervals);
    const { rows, hasIncompleteDraft, hasInvalidRange } = assessIntervals(intervals);
    if (hasIncompleteDraft || hasInvalidRange) return false;

    const { error: deleteError } = await supabase.from("hole_task_intervals").delete().eq("hole_id", selectedHole.id);
    if (deleteError) {
      setIntervalSaveState("error");
      setIntervalSaveMessage(deleteError.message);
      if (!silent) toast.error(deleteError.message);
      return false;
    }

    if (rows.length) {
      const { error: insertError } = await supabase.from("hole_task_intervals").insert(rows);
      if (insertError) {
        setIntervalSaveState("error");
        setIntervalSaveMessage(insertError.message);
        if (!silent) toast.error(insertError.message);
        return false;
      }
    }

    lastSavedIntervalsRef.current = currentSnapshot;
    setIntervalSaveState("saved");
    setIntervalSaveMessage("All interval changes saved.");
    await loadWorkflowStatus(holes.map((hole) => hole.id));
    if (!silent) toast.success("Intervals saved");
    return true;
  };

  const saveHole = async () => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    if (!selectedHole) return;
    if (!String(form.hole_id || "").trim()) return toast.error("Hole ID is required");
    if (!form.project_id) return toast.error("Project is required");

    setSaving(true);
    try {
      const azimuth = toNumOrNull(form.azimuth);
      const dip = toNumOrNull(form.dip);
      const collarEasting = toNumOrNull(form.collar_easting);
      const collarNorthing = toNumOrNull(form.collar_northing);
      const collarLongitude = toNumOrNull(form.collar_longitude);
      const collarLatitude = toNumOrNull(form.collar_latitude);
      const startedAt = toIsoOrNull(form.started_at);
      const completedAt = toIsoOrNull(form.completed_at);
      const currentProject = projects.find((project) => project.id === form.project_id) || null;

      if (!currentProject) return toast.error("Selected project could not be found");

      const projectedCoordinates = deriveHoleCoordinates({
        collarLongitude: null,
        collarLatitude: null,
        collarEasting,
        collarNorthing,
        projectCrsCode: currentProject.coordinate_crs_code || null,
      });

      const effectiveLongitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLongitude : collarLongitude;
      const effectiveLatitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLatitude : collarLatitude;

      if (form.azimuth !== "" && azimuth == null) return toast.error("Azimuth must be a number");
      if (form.dip !== "" && dip == null) return toast.error("Dip must be a number");
      if (azimuth != null && (azimuth < 0 || azimuth >= 360)) return toast.error("Azimuth must be between 0 and < 360");
      if (dip != null && (dip < -90 || dip > 90)) return toast.error("Dip must be between -90 and 90");
      if ((collarEasting == null) !== (collarNorthing == null)) return toast.error("Easting and northing must both be set or both blank");
      if ((collarEasting != null || collarNorthing != null) && !currentProject.coordinate_crs_code) {
        return toast.error("Set a project coordinate system before saving projected coordinates");
      }
      if ((collarLongitude == null) !== (collarLatitude == null)) return toast.error("Longitude and latitude must both be set or both blank");
      if (effectiveLongitude == null || effectiveLatitude == null) return toast.error("Enter either longitude and latitude or easting and northing");
      if (form.started_at && !startedAt) return toast.error("Started at is invalid");
      if (form.completed_at && !completedAt) return toast.error("Completed at is invalid");

      const payload = {
        hole_id: String(form.hole_id || "").trim(),
        depth: toNumOrNull(form.depth),
        planned_depth: toNumOrNull(form.planned_depth),
        water_level_m: toNumOrNull(form.water_level_m),
        azimuth,
        dip,
        collar_longitude: effectiveLongitude,
        collar_latitude: effectiveLatitude,
        collar_easting: collarEasting,
        collar_northing: collarNorthing,
        collar_elevation_m: toNumOrNull(form.collar_elevation_m),
        collar_source: toTextOrNull(form.collar_source),
        started_at: startedAt,
        completed_at: completedAt,
        completion_status: toTextOrNull(form.completion_status),
        completion_notes: toTextOrNull(form.completion_notes),
        state: form.state || "proposed",
        current_workflow_id: form.current_workflow_id || null,
        current_workflow_phase_id: form.current_workflow_phase_id || null,
        current_workflow_substage_id: form.current_workflow_substage_id || null,
        current_workflow_status_key: form.current_workflow_id ? form.current_workflow_status_key || "not_started" : null,
        drilling_diameter: form.drilling_diameter || null,
        drilling_contractor: toTextOrNull(form.drilling_contractor),
        project_id: form.project_id,
      };

      const result = isCreateMode
        ? await supabase.from("holes").insert({ ...payload, organization_id: orgId || null }).select("id").single()
        : await supabase.from("holes").update(payload).eq("id", selectedHole.id).select("id").single();

      if (result.error) throw result.error;

      const savedHoleId = result.data?.id || selectedHole.id;
      await replaceHoleDescriptorAssignments(supabase, {
        orgId,
        holeId: savedHoleId,
        descriptorIds: form.descriptor_ids,
      });

      const freshHoles = await loadData();
      const refreshedHole = freshHoles.find((hole) => hole.id === savedHoleId) || null;

      if (refreshedHole) {
        openHole(refreshedHole);
      }
      setIsCreateMode(false);
      toast.success(isCreateMode ? "Hole created" : "Hole updated");
    } catch (error) {
      toast.error(error?.message || (isCreateMode ? "Failed to create hole" : "Failed to update hole"));
    } finally {
      setSaving(false);
    }
  };

  const toggleHoleSelection = (holeId) => {
    setSelectedHoleIds((current) =>
      current.includes(holeId) ? current.filter((id) => id !== holeId) : [...current, holeId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedHoleIds((current) => current.filter((id) => !filteredHoleIds.includes(id)));
      return;
    }
    setSelectedHoleIds((current) => Array.from(new Set([...current, ...filteredHoleIds])));
  };

  const resetBulkEditForm = () => {
    setBulkEditForm({
      project_id: BULK_KEEP_VALUE,
      state: BULK_KEEP_VALUE,
      drilling_diameter: BULK_KEEP_VALUE,
      drilling_contractor_action: "keep",
      drilling_contractor: "",
      descriptor_action: "keep",
      descriptor_ids: [],
    });
  };

  const closeBulkEdit = (force = false) => {
    if (bulkUpdating && !force) return;
    setShowBulkEdit(false);
    resetBulkEditForm();
  };

  const openBulkEditModal = () => {
    if (projectScope === "shared") return;
    if (!selectedHoleIds.length) {
      toast.error("Select at least one hole to edit");
      return;
    }
    setShowBulkEdit(true);
    resetBulkEditForm();
  };

  const applyBulkEdit = async () => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    if (!selectedHoleIds.length) return toast.error("Select at least one hole to edit");

    const payload = {};

    if (bulkEditForm.project_id !== BULK_KEEP_VALUE) {
      const selectedProjectOption = projects.find((project) => project.id === bulkEditForm.project_id) || null;
      if (!selectedProjectOption) return toast.error("Select a valid project for bulk edit");
      payload.project_id = bulkEditForm.project_id;
    }

    if (bulkEditForm.state !== BULK_KEEP_VALUE) payload.state = bulkEditForm.state;
    if (bulkEditForm.drilling_diameter !== BULK_KEEP_VALUE) payload.drilling_diameter = bulkEditForm.drilling_diameter || null;

    if (bulkEditForm.drilling_contractor_action === "set") {
      const contractor = toTextOrNull(bulkEditForm.drilling_contractor);
      if (!contractor) return toast.error("Enter a drilling contractor to set");
      payload.drilling_contractor = contractor;
    }

    if (bulkEditForm.drilling_contractor_action === "clear") {
      payload.drilling_contractor = null;
    }

    if (bulkEditForm.descriptor_action === "set" && !bulkEditForm.descriptor_ids.length) {
      return toast.error("Choose at least one descriptor to apply");
    }

    if (Object.keys(payload).length === 0 && bulkEditForm.descriptor_action === "keep") {
      toast.error("Choose at least one change to apply");
      return;
    }

    setBulkUpdating(true);
    try {
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from("holes").update(payload).in("id", selectedHoleIds).eq("organization_id", orgId);
        if (error) throw error;
      }

      if (bulkEditForm.descriptor_action === "set" || bulkEditForm.descriptor_action === "clear") {
        await replaceManyHoleDescriptorAssignments(supabase, {
          orgId,
          holeIds: selectedHoleIds,
          descriptorIds: bulkEditForm.descriptor_action === "set" ? bulkEditForm.descriptor_ids : [],
        });
      }

      toast.success(`Updated ${selectedHoleIds.length} holes`);
      closeBulkEdit(true);
      await loadData();
    } catch (error) {
      toast.error(error?.message || "Failed to update selected holes");
    } finally {
      setBulkUpdating(false);
    }
  };

  const deleteHole = async (holeId) => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    const hole = holes.find((item) => item.id === holeId);
    const label = hole?.hole_id ? `hole ${hole.hole_id}` : "this hole";
    if (typeof window !== "undefined" && !window.confirm(`Delete ${label}? This will also remove its planned tasks and actuals.`)) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("holes").delete().eq("id", holeId).eq("organization_id", orgId);
      if (error) throw error;
      toast.success("Hole deleted");
      if (selectedHole?.id === holeId) closeHole();
      await loadData();
    } catch (error) {
      toast.error(error?.message || "Failed to delete hole");
    } finally {
      setDeleting(false);
    }
  };

  const renderOverlay = (content) => {
    if (!portalMounted) return null;
    return createPortal(content, document.body);
  };

  const viewHoleInMap = (holeId) => {
    const params = new URLSearchParams({ holeId });
    if (projectScope === "own" || projectScope === "shared") {
      params.set("scope", projectScope);
    }
    router.push(`/map?${params.toString()}`);
  };

  const viewHoleSchematic = (holeId) => {
    const params = new URLSearchParams({ holeId });
    if (projectScope === "own" || projectScope === "shared") {
      params.set("scope", projectScope);
    }
    router.push(`/drillhole-viz?${params.toString()}`);
  };

  return (
    <div className="p-4 md:p-5 space-y-5">
      <CoreTaskPanelHeader
        eyebrow="Core Workbench"
        title="Unified Core Workbench"
        description="One planning surface for hole details, status, and task intervals. This is the experimental combined flow before replacing the older tabs."
        stats={headerStats}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
              Live search and interval autosave
            </div>
            <button type="button" className="btn btn-3d-glass hidden md:inline-flex" onClick={openBulkEditModal} disabled={projectScope === "shared" || !selectedHoleIds.length}>
              Bulk editor
            </button>
            <button type="button" className="btn btn-3d-primary" onClick={openCreateHole} disabled={projectScope === "shared"}>
              Add New Core
            </button>
          </div>
        }
      />

      {projectScope !== "shared" && selectedHoleIds.length > 0 ? (
        <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-3 shadow-[0_18px_60px_rgba(2,6,23,0.22)] md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-100">{selectedHoleIds.length} hole{selectedHoleIds.length === 1 ? "" : "s"} selected</div>
              <div className="mt-1 text-xs text-slate-400 md:hidden">Quick actions for the current selection.</div>
              <div className="mt-1 hidden text-xs text-slate-400 md:block">Use the available actions below for quick selection management.</div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
              <button type="button" className="btn btn-3d-primary hidden md:inline-flex" onClick={openBulkEditModal} disabled={bulkUpdating}>
                Open bulk editor
              </button>
              <button type="button" className="btn btn-3d-glass w-full justify-center px-3 md:w-auto" onClick={() => setSelectedHoleIds([])} disabled={bulkUpdating}>
                Clear selection
              </button>
              <button type="button" className="btn btn-3d-glass w-full justify-center px-3 md:w-auto" onClick={toggleSelectAllFiltered}>
                {allFilteredSelected ? "Unselect filtered" : "Select filtered"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="md:hidden">
        <button
          type="button"
          className={["btn w-full justify-between px-4", showMobileFilters || activeFilterCount > 0 ? "btn-3d-glass" : ""].join(" ")}
          onClick={() => setShowMobileFilters((current) => !current)}
        >
          <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
          <span className="text-xs text-slate-300">{showMobileFilters ? "Hide" : "Show"}</span>
        </button>
      </div>

      <section className={["rounded-[30px] border border-white/10 bg-slate-950/50 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.35)] md:p-5", showMobileFilters ? "block" : "hidden md:block"].join(" ")}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,0.8fr))_auto] xl:items-end">
          <label className="flex min-w-[220px] flex-col gap-1.5 text-sm text-slate-200">
            Search holes
            <input
              className="input h-11"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hole ID, project, contractor..."
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-200">
            Project
            <select className="select-gradient-sm h-11" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-200">
            State
            <select className="select-gradient-sm h-11" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="">All states</option>
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {humanizeLabel(state)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-200">
            Diameter
            <select className="select-gradient-sm h-11" value={diameterFilter} onChange={(event) => setDiameterFilter(event.target.value)}>
              <option value="">All diameters</option>
              {DIAMETER_OPTIONS.filter(Boolean).map((diameter) => (
                <option key={diameter} value={diameter}>
                  {diameter}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-200">
            Descriptor
            <select className="select-gradient-sm h-11" value={descriptorFilter} onChange={(event) => setDescriptorFilter(event.target.value)}>
              <option value="">All descriptors</option>
              {descriptorFilterOptions.map((descriptor) => (
                <option key={descriptor.id} value={descriptor.id}>
                  {descriptor.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn btn-3d-glass h-11 px-5"
            onClick={() => {
              setSearch("");
              setProjectFilter("");
              setStateFilter("");
              setDiameterFilter("");
              setDescriptorFilter("");
              setShowMobileFilters(false);
            }}
          >
            Clear
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            Showing {filteredHoles.length} of {holes.length} hole{holes.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            {groupedFilteredHoles.length} project group{groupedFilteredHoles.length === 1 ? "" : "s"} in accordion view
          </span>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[30px] border border-white/10 bg-slate-950/40 px-4 py-8 text-center text-slate-300 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
          Loading holes…
        </div>
      ) : filteredHoles.length === 0 ? (
        <div className="rounded-[30px] border border-white/10 bg-slate-950/40 px-4 py-8 text-center text-slate-300 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
          No holes match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedFilteredHoles.map((group) => {
            const projectSelectedCount = group.holes.filter((hole) => selectedHoleIds.includes(hole.id)).length;
            const isExpanded = expandedProjectIds[group.id] ?? true;

            return (
              <section key={group.id} className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/40 shadow-[0_24px_80px_rgba(2,6,23,0.28)]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(8,47,73,0.5),rgba(30,41,59,0.62))] px-4 py-4 text-left transition-base hover:bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(8,47,73,0.58),rgba(30,41,59,0.68))] md:px-5"
                  onClick={() => setExpandedProjectIds((current) => ({ ...current, [group.id]: !isExpanded }))}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                      <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                        {group.holes.length} hole{group.holes.length === 1 ? "" : "s"}
                      </span>
                      {projectSelectedCount > 0 ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-200">
                          {projectSelectedCount} selected
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {isExpanded ? "Click to collapse this project" : "Click to expand and view holes"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <span className="hidden text-xs text-slate-400 md:inline">{isExpanded ? "Collapse" : "Expand"}</span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="grid gap-4 border-t border-white/10 p-4 xl:grid-cols-2 xl:p-5">
                    {group.holes.map((hole) => renderHoleCard(hole))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {selectedHole && renderOverlay(
        <div className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_32%),rgba(2,6,23,0.82)] p-3 md:p-6">
          <div className="flex h-full items-center justify-center">
            <div className="glass flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[34px] border border-white/15 bg-slate-950/90 shadow-[0_35px_120px_rgba(2,6,23,0.72)]">
              <div className="flex flex-col gap-3 border-b border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.55),rgba(15,23,42,0.92)_42%,rgba(88,28,135,0.32))] px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Unified Core Workbench</div>
                  <h3 className="mt-1 text-xl font-semibold text-white">{isCreateMode ? "Add new core and plan tasks" : form.hole_id || "Edit hole details"}</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Update collar details, drilling metadata, and planned task intervals from the same workspace.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isCreateMode ? (
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getWorkflowMeta(classifyHole(selectedHole)).className}`}>
                      {getWorkflowMeta(classifyHole(selectedHole)).label}
                    </span>
                  ) : null}
                  {!isCreateMode && selectedHole?.current_workflow_id ? (
                    <span
                      className="rounded-full border px-3 py-1.5 text-xs font-medium"
                      style={getWorkflowBadgeStyle(getWorkflowStatusMeta(selectedHole.current_workflow_status_key).color)}
                    >
                      {getWorkflowAssignmentLabel(selectedHole)}
                    </span>
                  ) : null}
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${getStateMeta(form.state).className}`}>
                    {getStateMeta(form.state).label}
                  </span>
                  <button type="button" className="btn btn-3d-glass" onClick={closeHole} disabled={saving || deleting}>
                    Close
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.9fr)]">
                  <section className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.3)] md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Hole details</div>
                        <div className="mt-1 text-lg font-semibold text-white">Field data and metadata</div>
                      </div>
                      {selectedProject ? (
                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-1.5 text-xs text-cyan-100">
                          {selectedProject.name}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-200">
                        Hole ID
                        <input className="input mt-1" value={form.hole_id} onChange={(event) => setForm((current) => ({ ...current, hole_id: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        State
                        <select className="select-gradient-sm mt-1" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}>
                          {STATE_OPTIONS.map((state) => (
                            <option key={state} value={state}>
                              {humanizeLabel(state)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Workflow
                        <select
                          className="select-gradient-sm mt-1"
                          value={form.current_workflow_id}
                          onChange={(event) => {
                            const nextSelection = resolveHierarchicalWorkflowSelection(holeWorkflows, event.target.value);
                            setForm((current) => ({
                              ...current,
                              current_workflow_id: nextSelection.workflowId,
                              current_workflow_phase_id: nextSelection.phaseId,
                              current_workflow_substage_id: nextSelection.substageId,
                              current_workflow_status_key: nextSelection.workflowId ? current.current_workflow_status_key || "not_started" : "not_started",
                            }));
                          }}
                        >
                          <option value="">No workflow</option>
                          {holeWorkflows.map((workflow) => (
                            <option key={workflow.id} value={workflow.id} disabled={workflow.is_active === false}>
                              {workflow.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Workflow Phase
                        <select
                          className="select-gradient-sm mt-1"
                          value={form.current_workflow_phase_id}
                          onChange={(event) => {
                            const nextPhaseId = event.target.value;
                            const nextSubstageId = getWorkflowSubstageOptions(holeWorkflows.find((workflow) => workflow.id === form.current_workflow_id) || null, nextPhaseId)[0]?.id || "";
                            setForm((current) => ({
                              ...current,
                              current_workflow_phase_id: nextPhaseId,
                              current_workflow_substage_id: nextSubstageId,
                            }));
                          }}
                          disabled={!form.current_workflow_id}
                        >
                          <option value="">{form.current_workflow_id ? "Select a phase" : "Choose a workflow first"}</option>
                          {getWorkflowPhaseOptions(holeWorkflows.find((workflow) => workflow.id === form.current_workflow_id) || null).map((phase) => (
                            <option key={phase.id} value={phase.id}>
                              {formatWorkflowPhaseLabel(phase)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Workflow Substage
                        <select
                          className="select-gradient-sm mt-1"
                          value={form.current_workflow_substage_id}
                          onChange={(event) => setForm((current) => ({ ...current, current_workflow_substage_id: event.target.value }))}
                          disabled={!form.current_workflow_phase_id}
                        >
                          <option value="">{form.current_workflow_phase_id ? "No substage" : "Choose a phase first"}</option>
                          {getWorkflowSubstageOptions(
                            holeWorkflows.find((workflow) => workflow.id === form.current_workflow_id) || null,
                            form.current_workflow_phase_id
                          ).map((substage) => (
                            <option key={substage.id} value={substage.id}>
                              {formatWorkflowSubstageLabel(substage)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Workflow Status
                        <select
                          className="select-gradient-sm mt-1"
                          value={form.current_workflow_status_key}
                          onChange={(event) => setForm((current) => ({ ...current, current_workflow_status_key: event.target.value }))}
                          disabled={!form.current_workflow_phase_id}
                        >
                          {WORKFLOW_STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Depth (m)
                        <input className="input mt-1" type="number" step="0.1" value={form.depth} onChange={(event) => setForm((current) => ({ ...current, depth: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Planned depth (m)
                        <input className="input mt-1" type="number" step="0.1" value={form.planned_depth} onChange={(event) => setForm((current) => ({ ...current, planned_depth: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Water level (m)
                        <input className="input mt-1" type="number" step="0.1" value={form.water_level_m} onChange={(event) => setForm((current) => ({ ...current, water_level_m: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Diameter
                        <select className="select-gradient-sm mt-1" value={form.drilling_diameter} onChange={(event) => setForm((current) => ({ ...current, drilling_diameter: event.target.value }))}>
                          {DIAMETER_OPTIONS.map((diameter) => (
                            <option key={diameter || "none"} value={diameter}>
                              {diameter || "Select..."}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Azimuth (deg)
                        <input className="input mt-1" type="number" step="0.1" min="0" max="359.9" value={form.azimuth} onChange={(event) => setForm((current) => ({ ...current, azimuth: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Dip (deg)
                        <input className="input mt-1" type="number" step="0.1" min="-90" max="90" value={form.dip} onChange={(event) => setForm((current) => ({ ...current, dip: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200 md:col-span-2">
                        Drilling contractor
                        <input className="input mt-1" value={form.drilling_contractor} onChange={(event) => setForm((current) => ({ ...current, drilling_contractor: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200 md:col-span-2">
                        Hole descriptors
                        <DescriptorMultiSelect
                          options={availableDescriptors}
                          value={form.descriptor_ids}
                          onChange={(descriptorIds) => setForm((current) => ({ ...current, descriptor_ids: descriptorIds }))}
                          emptyText="Create hole descriptors for this org to tag holes here."
                        />
                        <div className="mt-2 text-xs text-slate-400">{formatDescriptorSummary((availableDescriptors || []).filter((descriptor) => (form.descriptor_ids || []).includes(descriptor.id)))}</div>
                      </label>

                      <label className="text-sm text-slate-200 md:col-span-2">
                        Project *
                        <select className="select-gradient-sm mt-1" value={form.project_id} onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}>
                          <option value="">Select a project...</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {form.project_id ? (
                        <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300 md:col-span-2">
                          Working CRS: {formatProjectCrs(selectedProject)}
                        </div>
                      ) : null}

                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3 md:col-span-2">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Map selection</div>
                            <div className="mt-1 text-sm text-slate-200">Choose the collar visually and write longitude and latitude back into this form.</div>
                            <div className="mt-1 text-xs text-slate-400">Project must be selected first so the picker can highlight the right hole context.</div>
                          </div>
                          <button type="button" className="btn btn-3d-glass" onClick={openLocationPicker} disabled={projectScope === "shared" || !form.project_id}>
                            Find on Map
                          </button>
                        </div>
                      </div>

                      <label className="text-sm text-slate-200">
                        Collar longitude (WGS84)
                        <input className="input mt-1" type="number" step="0.000001" value={form.collar_longitude} onChange={(event) => setForm((current) => ({ ...current, collar_longitude: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Collar latitude (WGS84)
                        <input className="input mt-1" type="number" step="0.000001" value={form.collar_latitude} onChange={(event) => setForm((current) => ({ ...current, collar_latitude: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Collar easting
                        <input className="input mt-1" type="number" step="0.001" value={form.collar_easting} onChange={(event) => setForm((current) => ({ ...current, collar_easting: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Collar northing
                        <input className="input mt-1" type="number" step="0.001" value={form.collar_northing} onChange={(event) => setForm((current) => ({ ...current, collar_northing: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Collar elevation (m)
                        <input className="input mt-1" type="number" step="0.01" value={form.collar_elevation_m} onChange={(event) => setForm((current) => ({ ...current, collar_elevation_m: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Collar source
                        <select className="select-gradient-sm mt-1" value={form.collar_source} onChange={(event) => setForm((current) => ({ ...current, collar_source: event.target.value }))}>
                          {COLLAR_SOURCE_OPTIONS.map((source) => (
                            <option key={source || "none"} value={source}>
                              {source || "Select..."}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200">
                        Started at
                        <input className="input mt-1" type="datetime-local" value={form.started_at} onChange={(event) => setForm((current) => ({ ...current, started_at: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Completed at
                        <input className="input mt-1" type="datetime-local" value={form.completed_at} onChange={(event) => setForm((current) => ({ ...current, completed_at: event.target.value }))} />
                      </label>

                      <label className="text-sm text-slate-200">
                        Completion status
                        <select className="select-gradient-sm mt-1" value={form.completion_status} onChange={(event) => setForm((current) => ({ ...current, completion_status: event.target.value }))}>
                          {COMPLETION_STATUS_OPTIONS.map((status) => (
                            <option key={status || "none"} value={status}>
                              {status || "Select..."}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-slate-200 md:col-span-2">
                        Completion notes
                        <textarea className="textarea mt-1" rows={3} value={form.completion_notes} onChange={(event) => setForm((current) => ({ ...current, completion_notes: event.target.value }))} />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {!isCreateMode && projectScope !== "shared" ? (
                        <button type="button" className="btn btn-danger mr-auto" onClick={() => void deleteHole(selectedHole.id)} disabled={saving || deleting}>
                          {deleting ? "Deleting..." : "Delete Hole"}
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-3d-glass" onClick={closeHole} disabled={saving || deleting}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-3d-primary" onClick={saveHole} disabled={saving || projectScope === "shared"}>
                        {saving ? "Saving..." : isCreateMode ? "Save and continue" : "Save changes"}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.3)] md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Task planning</div>
                        <div className="mt-1 text-lg font-semibold text-white">Interval planner</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-[11px] ${
                        intervalSaveState === "error"
                          ? "bg-rose-500/15 text-rose-100"
                          : intervalSaveState === "saving"
                            ? "bg-amber-500/15 text-amber-100"
                            : intervalSaveState === "draft"
                              ? "bg-slate-700/70 text-slate-200"
                              : "bg-emerald-500/15 text-emerald-100"
                      }`}>
                        {intervalSaveMessage}
                      </div>
                    </div>

                    {selectedHole?.id ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Planned segments</div>
                            <div className="mt-1 text-lg font-semibold text-white">{intervalSummary.rowCount}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Planned metres</div>
                            <div className="mt-1 text-lg font-semibold text-white">{intervalSummary.totalMeters.toFixed(1)} m</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {taskTypeKeys.map((taskKey) => (
                            <div key={taskKey} className="glass rounded-2xl border border-white/10 p-3 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-100">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorForTask(taskKey) }} />
                                  {labelForTask(taskKey)}
                                </span>
                                <button type="button" className="btn btn-3d-primary btn-xs" onClick={() => addInterval(taskKey)}>
                                  + Interval
                                </button>
                              </div>

                              <div className="space-y-2">
                                {(intervals[taskKey] || []).map((row, index) => (
                                  <div key={`${taskKey}-${index}`} className="flex items-center gap-2">
                                    <input
                                      className="input input-xs w-20"
                                      placeholder="From"
                                      value={row.from_m}
                                      onChange={(event) => changeInterval(taskKey, index, "from_m", event.target.value)}
                                    />
                                    <span className="text-xs text-slate-400">→</span>
                                    <input
                                      className="input input-xs w-20"
                                      placeholder="To"
                                      value={row.to_m}
                                      onChange={(event) => changeInterval(taskKey, index, "to_m", event.target.value)}
                                    />
                                    <button type="button" className="btn btn-3d-glass btn-xs" onClick={() => removeInterval(taskKey, index)}>
                                      ×
                                    </button>
                                  </div>
                                ))}
                                {!intervals[taskKey]?.length ? <div className="text-xs italic text-slate-500">No intervals planned</div> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                        Save this new hole first, then the interval planner will unlock and autosave changes as you edit.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedHole && showLocationPicker && selectedProject && renderOverlay(
        <HoleLocationPickerModal
          project={selectedProject}
          initialLongitude={form.collar_longitude}
          initialLatitude={form.collar_latitude}
          onClose={() => setShowLocationPicker(false)}
          onConfirm={(location) => {
            setForm((current) => ({
              ...current,
              collar_longitude: String(location.longitude),
              collar_latitude: String(location.latitude),
              collar_source: "map_picked",
            }));
            setShowLocationPicker(false);
          }}
        />
      )}

      {showBulkEdit && renderOverlay(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass w-full max-w-2xl rounded-[28px] border border-white/15 bg-slate-950/90 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.65)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Bulk editor</h3>
                <p className="mt-1 text-sm text-slate-300">Apply shared changes to {selectedHoleIds.length} selected hole{selectedHoleIds.length === 1 ? "" : "s"}.</p>
              </div>
              <button type="button" className="btn btn-3d-glass" onClick={() => closeBulkEdit()} disabled={bulkUpdating}>
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-200">
                Project
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.project_id}
                  onChange={(event) => setBulkEditForm((current) => ({ ...current, project_id: event.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep existing project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-200">
                State
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.state}
                  onChange={(event) => setBulkEditForm((current) => ({ ...current, state: event.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep existing state</option>
                  {STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {humanizeLabel(state)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-200">
                Diameter
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.drilling_diameter}
                  onChange={(event) => setBulkEditForm((current) => ({ ...current, drilling_diameter: event.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep existing diameter</option>
                  <option value="">Clear diameter</option>
                  {DIAMETER_OPTIONS.filter(Boolean).map((diameter) => (
                    <option key={diameter} value={diameter}>
                      {diameter}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-200">
                Contractor action
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.drilling_contractor_action}
                  onChange={(event) => setBulkEditForm((current) => ({ ...current, drilling_contractor_action: event.target.value }))}
                >
                  <option value="keep">Keep existing contractor</option>
                  <option value="set">Set contractor</option>
                  <option value="clear">Clear contractor</option>
                </select>
              </label>

              <label className="text-sm text-slate-200 md:col-span-2">
                Descriptor action
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.descriptor_action}
                  onChange={(event) => setBulkEditForm((current) => ({ ...current, descriptor_action: event.target.value }))}
                >
                  <option value="keep">Keep existing descriptors</option>
                  <option value="set">Replace with selected descriptors</option>
                  <option value="clear">Clear all descriptors</option>
                </select>
              </label>

              {bulkEditForm.descriptor_action === "set" ? (
                <label className="text-sm text-slate-200 md:col-span-2">
                  Hole descriptors
                  <DescriptorMultiSelect
                    options={availableDescriptors}
                    value={bulkEditForm.descriptor_ids}
                    onChange={(descriptorIds) => setBulkEditForm((current) => ({ ...current, descriptor_ids: descriptorIds }))}
                    emptyText="Create hole descriptors for this org to use bulk descriptor edits."
                  />
                </label>
              ) : null}

              {bulkEditForm.drilling_contractor_action === "set" ? (
                <label className="text-sm text-slate-200 md:col-span-2">
                  Drilling contractor
                  <input
                    className="input mt-1"
                    value={bulkEditForm.drilling_contractor}
                    onChange={(event) => setBulkEditForm((current) => ({ ...current, drilling_contractor: event.target.value }))}
                    placeholder="Enter contractor name"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-3d-glass" onClick={() => closeBulkEdit()} disabled={bulkUpdating}>
                Cancel
              </button>
              <button type="button" className="btn btn-3d-primary" onClick={applyBulkEdit} disabled={bulkUpdating}>
                {bulkUpdating ? "Applying..." : "Apply changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}