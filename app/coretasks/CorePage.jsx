"use client";
import { useEffect, useMemo, useState, Fragment, useRef } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";
import { DEFAULT_TASK_TYPE_DEFS, fetchOrgTaskTypes } from "@/lib/taskTypes";

function MobileFiltersDrawer({ open, onClose, children }) {
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
    <div className="filter-drawer-backdrop fixed inset-0 z-[88] flex items-end justify-center bg-slate-950/54 backdrop-blur-sm" onClick={onClose}>
      <div
        className="filter-drawer-panel flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-[32px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_-28px_90px_rgba(2,6,23,0.48)] sm:max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-16 rounded-full bg-cyan-200/30 shadow-[0_0_24px_rgba(34,211,238,0.25)]" />
        </div>
        <div className="border-b border-white/10 px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Drilling Logging</div>
              <div className="mt-1 text-lg font-semibold text-white">Filters</div>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-8">{children}</div>
      </div>
    </div>
  );
}

// Compute whether a set of planned intervals is fully covered by progress intervals
function isFullyCovered(plannedIntervals, progressByTask) {
  if (!Array.isArray(plannedIntervals) || plannedIntervals.length === 0) return false;
  return plannedIntervals.every((pi) => {
    const overlaps = (progressByTask[pi.task_type] || []).filter(
      (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
    );
    let cursor = Number(pi.from_m);
    for (const p of overlaps.sort((a, b) => Number(a.from_m) - Number(b.from_m))) {
      if (Number(p.from_m) > cursor) break; // gap
      if (Number(p.to_m) > cursor) cursor = Number(p.to_m);
    }
    return cursor >= Number(pi.to_m);
  });
}

function overlapLen(a1, a2, b1, b2) {
  const start = Math.max(Number(a1), Number(b1));
  const end = Math.min(Number(a2), Number(b2));
  return Math.max(0, end - start);
}

function humanizeTaskKey(taskKey) {
  return String(taskKey || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CorePage({ projectScope = "own", focusedHoleId = "" }) {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();
  const defaultTaskMeta = useMemo(
    () =>
      Object.fromEntries(
        DEFAULT_TASK_TYPE_DEFS.map((task) => [task.key, { label: task.name, color: task.color || "#64748b" }])
      ),
    []
  );
  const [holes, setHoles] = useState([]); // {id, hole_id}
  const [loading, setLoading] = useState(true);
  const [holeStatus, setHoleStatus] = useState({}); // { [holeId]: { hasPlanned: boolean, complete: boolean } }
  const [expandedHole, setExpandedHole] = useState({}); // { [holeId]: true }
  const [expandedTask, setExpandedTask] = useState({}); // { `${holeId}:${task}`: true }
  const [details, setDetails] = useState({}); // { [holeId]: { tasks: { [task]: { intervals, progress } }, order: string[], complete: boolean } }
  const [inputs, setInputs] = useState({}); // { `${holeId}:${task}:${from}-${to}`: { from_m, to_m, disabled } }
  const [savingKey, setSavingKey] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loggedOn, setLoggedOn] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  // Multi-select status filters; empty or all selected => show all
  const [holeFilters, setHoleFilters] = useState(['complete','in_progress','not_started']);
  const [taskMeta, setTaskMeta] = useState(defaultTaskMeta);
  const [portalMounted, setPortalMounted] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const autoOpenedHoleRef = useRef("");
  const autoScrolledHoleRef = useRef("");

  const projects = useMemo(() => {
    const set = new Set();
    (holes || []).forEach((h) => {
      if (h.projects?.name) set.add(h.projects.name);
    });
    return Array.from(set).sort();
  }, [holes]);

  const focusedHole = useMemo(
    () => (focusedHoleId ? holes.find((hole) => hole.id === focusedHoleId) || null : null),
    [focusedHoleId, holes]
  );

  const classifyHole = (h) => {
    const s = holeStatus[h.id] || {};
    if (s.hasPlanned) {
      if (s.complete) return 'complete';
      if (s.hasProgress) return 'in_progress';
      return 'not_started';
    }
    return s.hasProgress ? 'in_progress' : 'not_started';
  };

  const filteredHoles = useMemo(() => {
    const byProject = !selectedProject ? holes : (holes || []).filter(h => h.projects?.name === selectedProject);
    const active = holeFilters || [];
    const byStatus = active.length === 0 || active.length === 3 ? byProject : byProject.filter(h => active.includes(classifyHole(h)));
    const term = search.trim().toLowerCase();
    if (!term) return byStatus;
    return byStatus.filter((hole) => String(hole.hole_id || "").toLowerCase().includes(term));
  }, [holes, search, selectedProject, holeFilters, holeStatus]);

  const plannedHoleCount = useMemo(
    () => holes.filter((hole) => holeStatus[hole.id]?.hasPlanned).length,
    [holes, holeStatus]
  );

  const loggingHeaderStats = useMemo(
    () => [
      { label: "visible holes", value: loading ? "..." : filteredHoles.length },
      { label: "planned holes", value: loading ? "..." : plannedHoleCount },
      { label: "log date", value: loggedOn || "-" },
    ],
    [filteredHoles.length, loading, loggedOn, plannedHoleCount]
  );

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!portalMounted || !showMobileFilters) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalMounted, showMobileFilters]);

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
                label: task.name || humanizeTaskKey(task.key),
                color: task.color || DEFAULT_TASK_TYPE_DEFS[index % DEFAULT_TASK_TYPE_DEFS.length]?.color || "#64748b",
              },
            ])
          )
        );
      } catch (error) {
        console.error("Could not load task labels", error);
        if (!active) return;
        setTaskMeta(defaultTaskMeta);
      }
    })();

    return () => {
      active = false;
    };
  }, [defaultTaskMeta, orgId, supabase]);

  const toggleStatusFilter = (status) => {
    setHoleFilters((prev) => {
      const exists = prev.includes(status);
      let next = exists ? prev.filter(s => s !== status) : [...prev, status];
      // If none selected, treat as all (reset to all three for clarity)
      if (next.length === 0) next = ['complete','in_progress','not_started'];
      return next;
    });
  };

  const allSelected = holeFilters.length === 3;
  const activeFilterCount = useMemo(
    () => [search.trim(), selectedProject, allSelected ? "" : "status"].filter(Boolean).length,
    [allSelected, search, selectedProject]
  );

  const getStatusMeta = (holeId) => {
    const s = holeStatus[holeId] || {};
    if (s.hasPlanned && s.complete) return { label: 'Completed', cls: 'badge badge-green' };
    if (s.hasPlanned || s.hasProgress) return { label: 'In Progress', cls: 'badge badge-amber' };
    return { label: 'Not Started', cls: 'badge badge-gray' };
  };

  const taskLabel = (taskKey) => taskMeta[taskKey]?.label || humanizeTaskKey(taskKey);
  const taskColor = (taskKey) => taskMeta[taskKey]?.color || "#64748b";

  useEffect(() => {
    if (!focusedHole) return;

    const nextProject = focusedHole.projects?.name || "";
    if (selectedProject !== nextProject) {
      setSelectedProject(nextProject);
    }

    if (holeFilters.length !== 3) {
      setHoleFilters(["complete", "in_progress", "not_started"]);
    }
  }, [focusedHole, holeFilters.length, selectedProject]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      let holesData = [];
      if (projectScope === "shared") {
        const { data: sharedRows } = await supabase
          .from("organization_shared_projects")
          .select("project_id, relationship:relationship_id(vendor_organization_id,status,permissions,accepted_at)")
          .limit(5000);

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
          const { data } = await supabase
            .from("holes")
            .select("id, hole_id, depth, project_id, organization_id, projects(name)")
            .in("project_id", sharedProjectIds)
            .neq("organization_id", orgId);
          holesData = data || [];
        }
      } else {
        const { data } = await supabase
          .from("holes")
          .select("id, hole_id, depth, project_id, projects(name)")
          .eq("organization_id", orgId);
        holesData = data || [];
      }
      setHoles(holesData || []);
      const ids = (holesData || []).map((h) => h.id);
      if (ids.length > 0) {
        const [planRes, progRes] = await Promise.all([
          supabase
            .from("hole_task_intervals")
            .select("hole_id, task_type, from_m, to_m")
            .in("hole_id", ids),
          supabase
            .from("hole_task_progress")
            .select("hole_id, task_type, from_m, to_m")
            .in("hole_id", ids),
        ]);
        const intervals = planRes.data || [];
        const progress = progRes.data || [];
        const intervalsByHole = {};
        intervals.forEach((r) => {
          (intervalsByHole[r.hole_id] ||= []).push(r);
        });
        const progressByHole = {};
        progress.forEach((p) => {
          (progressByHole[p.hole_id] ||= []).push(p);
        });
        const statusMap = {};
        ids.forEach((id) => {
          const planned = intervalsByHole[id] || [];
          const progArr = progressByHole[id] || [];
          const byTask = {};
          progArr.forEach((p) => {
            (byTask[p.task_type] ||= []).push(p);
          });
          const complete = isFullyCovered(planned, byTask);
          statusMap[id] = { hasPlanned: planned.length > 0, complete, hasProgress: progArr.length > 0 };
        });
        setHoleStatus(statusMap);
      }
      setLoading(false);
    })();
  }, [supabase, orgId, projectScope]);

  // current user id for labeling progress entries
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id || null);
    })();
  }, [supabase]);

  const holeKey = (holeId, t) => `${holeId}:${t}`;
  const rowKey = (holeId, t, f, to) => `${holeId}:${t}:${f}-${to}`;

  const renderOverlay = (content) => {
    if (!portalMounted) return null;
    return createPortal(content, document.body);
  };

  const initInputsForHole = (holeId, planRows, progRows) => {
    // group progress by task and sort
    const byTask = {};
    (progRows || []).forEach((p) => {
      if (!byTask[p.task_type]) byTask[p.task_type] = [];
      byTask[p.task_type].push(p);
    });
    Object.values(byTask).forEach((arr) => arr.sort((a, b) => Number(a.from_m) - Number(b.from_m)));

    const next = { ...inputs };
    (planRows || []).forEach((pi) => {
      const key = rowKey(holeId, pi.task_type, pi.from_m, pi.to_m);
      const overlaps = (byTask[pi.task_type] || []).filter(
        (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
      );
      let cursor = Number(pi.from_m);
      for (const p of overlaps) {
        if (Number(p.from_m) > cursor) break;
        if (Number(p.to_m) > cursor) cursor = Number(p.to_m);
      }
      const fullyCovered = cursor >= Number(pi.to_m);
      next[key] = fullyCovered
        ? { from_m: Number(pi.from_m), to_m: Number(pi.to_m), disabled: true }
        : { from_m: cursor, to_m: "", disabled: false };
    });
    setInputs(next);
  };

  const loadHoleDetails = async (holeId) => {
    try {
      const [planRes, progRes] = await Promise.all([
        supabase
          .from("hole_task_intervals")
          .select("task_type, from_m, to_m")
          .eq("hole_id", holeId)
          .order("task_type", { ascending: true })
          .order("from_m", { ascending: true }),
        supabase
          .rpc("get_hole_progress_with_email", { p_hole_id: holeId })
      ]);
      const intervals = planRes.data || [];
      const progress = (progRes.data || []).sort((a,b) => a.task_type.localeCompare(b.task_type) || Number(a.from_m)-Number(b.from_m));
      const tasks = {};
      const order = [];
      intervals.forEach((r) => {
        if (!tasks[r.task_type]) {
          tasks[r.task_type] = { intervals: [], progress: [] };
          order.push(r.task_type);
        }
        tasks[r.task_type].intervals.push({ from_m: r.from_m, to_m: r.to_m });
      });
      progress.forEach((p) => {
        if (!tasks[p.task_type]) {
          tasks[p.task_type] = { intervals: [], progress: [] };
          order.push(p.task_type);
        }
        tasks[p.task_type].progress.push(p);
      });
      // compute completion across all tasks via shared helper for consistency
      const allPlanned = intervals;
      const byTask = {};
      (progress || []).forEach((p) => {
        (byTask[p.task_type] ||= []).push(p);
      });
      const fullyCovered = isFullyCovered(allPlanned, byTask);
      setDetails((d) => ({ ...d, [holeId]: { tasks, order, complete: fullyCovered } }));
      // update status map based on detailed computation
  setHoleStatus((m) => ({ ...m, [holeId]: { hasPlanned: allPlanned.length > 0, complete: fullyCovered, hasProgress: (progress || []).length > 0 } }));
      initInputsForHole(holeId, intervals, progress);
    } catch (e) {
      // noop
    }
  };

  const toggleHole = async (holeId) => {
    setExpandedHole((m) => ({ ...m, [holeId]: !m[holeId] }));
    const willOpen = !expandedHole[holeId];
    if (willOpen && !details[holeId]) {
      await loadHoleDetails(holeId);
    }
  };

  const toggleTask = (holeId, task) => {
    const k = holeKey(holeId, task);
    setExpandedTask((m) => ({ ...m, [k]: !m[k] }));
  };

  const saveInterval = async (holeId, task, plannedFrom, plannedTo, fromOverride, toOverride) => {
    const key = rowKey(holeId, task, plannedFrom, plannedTo);
    const state = inputs[key] || {};
    const from_m = Number(fromOverride ?? state.from_m);
    const to_m = Number(toOverride ?? state.to_m);
    if (!task || isNaN(from_m) || isNaN(to_m) || to_m <= from_m) {
      toast.error("Enter a valid interval (to > from)");
      return;
    }
    if (from_m < Number(plannedFrom) || to_m > Number(plannedTo)) {
      toast.error("Interval must be within planned range");
      return;
    }
    setSavingKey(key);
    const { error } = await supabase.from("hole_task_progress").insert({
      hole_id: holeId,
      task_type: task,
      from_m,
      to_m,
  logged_on: loggedOn,
    });
    setSavingKey(null);
    if (error) {
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("exclusion") || msg.toLowerCase().includes("overlap") || msg.includes("&&")) {
        toast.error("Overlaps an existing entry for this task.");
      } else if (msg.toLowerCase().includes("row level security") || error.code === "42501") {
        toast.error("Sign in required to record progress.");
      } else {
        toast.error("Could not save progress.");
      }
      return;
    }
    toast.success("Saved");
    await loadHoleDetails(holeId);
  // Status is already refreshed via loadHoleDetails using the same logic as initial load
  };

  // 1) Ensure your "Add New Core" / "Add Hole" form state includes planned_depth
  const [newHole, setNewHole] = useState({
    hole_id: "",
    depth: "",
    planned_depth: "", // <-- add
    drilling_diameter: "",
    project_id: "",
    drilling_contractor: "",
  });

  function toNumOrNull(v) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function onNewHoleChange(e) {
    const { name, value } = e.target;
    setNewHole((prev) => ({ ...prev, [name]: value }));
  }

  async function addHole() {
    const holeId = (newHole.hole_id || "").trim();
    if (!holeId) {
      toast.error("Hole ID is required.");
      return;
    }
    if (!newHole.project_id) {
      toast.error("Project is required.");
      return;
    }

    const payload = {
      organization_id: orgId,
      hole_id: holeId,
      depth: toNumOrNull(newHole.depth), // actual depth
      planned_depth: toNumOrNull(newHole.planned_depth), // planned depth (optional)
      drilling_diameter: newHole.drilling_diameter || null,
      project_id: newHole.project_id,
      drilling_contractor: (newHole.drilling_contractor || "").trim() || null,
      // state will default to 'proposed' in DB unless you set it here
      // ...existing code...
    };

    const { error } = await supabase.from("holes").insert(payload);
    if (error) {
      // ...existing code...
      return;
    }

    // ...existing code (refresh list, close modal, reset state)...
    setNewHole((prev) => ({ ...prev, planned_depth: "" }));
  }

  useEffect(() => {
    if (!focusedHoleId) return;
    if (!filteredHoles.some((hole) => hole.id === focusedHoleId)) return;
    if (autoOpenedHoleRef.current === focusedHoleId && expandedHole[focusedHoleId]) return;

    autoOpenedHoleRef.current = focusedHoleId;
    setExpandedHole((current) => ({ ...current, [focusedHoleId]: true }));

    if (!details[focusedHoleId]) {
      void loadHoleDetails(focusedHoleId);
    }
  }, [details, expandedHole, filteredHoles, focusedHoleId]);

  useEffect(() => {
    if (!focusedHoleId || !expandedHole[focusedHoleId]) return;
    if (autoScrolledHoleRef.current === focusedHoleId) return;

    const row = document.querySelector(`[data-core-hole-id="${focusedHoleId}"]`);
    if (!row) return;

    autoScrolledHoleRef.current = focusedHoleId;
    row.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [expandedHole, focusedHoleId]);

  const filtersPanelContent = (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] xl:items-end">
        <label className="flex flex-col gap-1.5 text-sm text-slate-200">
          Project
          <select className="select-gradient-sm h-11" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm text-slate-200">
          <span>Status</span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'complete', label: 'Completed', color: 'bg-green-500' },
              { key: 'in_progress', label: 'In progress', color: 'bg-amber-500' },
              { key: 'not_started', label: 'Not started', color: 'bg-gray-400' },
            ].map((option) => {
              const active = holeFilters.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleStatusFilter(option.key)}
                  className={[
                    "inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm transition",
                    active
                      ? "border-cyan-200/30 bg-cyan-200/12 text-slate-50 shadow-[0_12px_28px_rgba(34,211,238,0.14)]"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-100",
                  ].join(" ")}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${option.color}`} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-3d-glass h-11 px-5"
          onClick={() => {
            setSearch("");
            setSelectedProject("");
            setHoleFilters(["complete", "in_progress", "not_started"]);
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
          Status {allSelected ? "all" : `${holeFilters.length} selected`}
        </span>
      </div>
    </>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <CoreTaskPanelHeader
        eyebrow="Drilling Logging"
        title=""
        stats={loggingHeaderStats}
      />

      <div className="card p-4 md:p-5">
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div className="text-sm text-slate-200">Hole name</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                className={[
                  "btn text-left sm:text-center",
                  activeFilterCount > 0
                    ? "border-cyan-200/30 bg-[linear-gradient(145deg,rgba(8,47,73,0.95),rgba(6,78,59,0.8),rgba(14,116,144,0.78))] text-cyan-50 shadow-[0_18px_50px_rgba(34,211,238,0.22)] hover:border-cyan-200/40 hover:bg-[linear-gradient(145deg,rgba(8,47,73,0.98),rgba(6,95,70,0.84),rgba(8,145,178,0.82))]"
                    : "btn-3d-glass",
                ].join(" ")}
                onClick={() => setShowMobileFilters(true)}
              >
                <span className="flex items-center gap-2">
                  <span>Filters</span>
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-cyan-100/25 bg-cyan-200/18 px-2 py-0.5 text-[11px] font-semibold text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          </div>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-slate-200 xl:max-w-sm">
            <input
              className="input h-11"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by hole name as you type..."
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/35 px-4 py-3">
            <label className="text-sm text-slate-200">Entering actuals for the date of</label>
            <input
              type="date"
              className="input input-sm w-auto"
              value={loggedOn}
              onChange={(e) => setLoggedOn(e.target.value)}
            />
          </div>
        </div>

        {renderOverlay(
          <MobileFiltersDrawer open={showMobileFilters} onClose={() => setShowMobileFilters(false)}>
            {filtersPanelContent}
          </MobileFiltersDrawer>
        )}

      {loading ? (
        <p>Loading…</p>
      ) : holes.length === 0 ? (
        <p className="text-sm text-slate-300">No holes available.</p>
      ) : (
        <>
          {/* Desktop/tablet table */}
          <div className="overflow-x-auto hidden md:block">
            <div className="table-container">
              <table className="table">
                <thead>
              <tr>
                <th className="text-left p-2 border w-10"></th>
                <th className="text-left p-2 border">Hole</th>
                <th className="text-left p-2 border w-32">Depth (m)</th>
              </tr>
                </thead>
                <tbody>
              {filteredHoles.map((h) => (
                <Fragment key={h.id}>
                  <tr data-core-hole-id={h.id} className={focusedHoleId === h.id ? "bg-cyan-400/[0.06]" : undefined}>
                    <td className="p-2 border align-top">
                      <button className="btn btn-3d-glass text-xs" onClick={() => toggleHole(h.id)}>
                        {expandedHole[h.id] ? "−" : "+"}
                      </button>
                    </td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <span>{h.hole_id}</span>
                        <span className={getStatusMeta(h.id).cls}>{getStatusMeta(h.id).label}</span>
                      </div>
                    </td>
                    <td className="p-2 border align-top">{h?.depth ?? "-"}</td>
                  </tr>
                  {expandedHole[h.id] && (
                    <tr>
                      <td className="p-0 border-l border-r" colSpan={3}>
                        <div className="p-3">
                          {!details[h.id] ? (
                            <p className="text-sm text-slate-300">Loading…</p>
                          ) : Object.keys(details[h.id].tasks).length === 0 ? (
                            <p className="text-sm text-slate-300">No planned logging for this hole.</p>
                          ) : (
                            <div className="table-container">
                              <table className="table">
                                <thead>
                                <tr>
                                  <th className="text-left p-2 border w-10"></th>
                                  <th className="text-left p-2 border">Task</th>
                                </tr>
                                </thead>
                                <tbody>
                                {details[h.id].order.map((task) => (
                                  <Fragment key={task}>
                                    <tr className="hover:bg-white">
                                      <td className="p-2 border align-top">
                                        <button
                                          className="btn btn-3d-glass text-[10px]"
                                          onClick={() => toggleTask(h.id, task)}
                                        >
                                          {expandedTask[holeKey(h.id, task)] ? "−" : "+"}
                                        </button>
                                      </td>
                                      <td className="p-2 border">
                                        <span className="inline-flex items-center gap-2">
                                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: taskColor(task) }} />
                                          {taskLabel(task)}
                                        </span>
                                      </td>
                                    </tr>
                                    {expandedTask[holeKey(h.id, task)] && (
                                      <tr>
                                        <td className="p-0 border-l border-r" colSpan={2}>
                                          <div className="p-2">
                                            <table className="w-full text-xs border">
                                              <thead className="bg-gray-50 sticky top-12 z-10">
                                                <tr>
                                                  <th className="text-left p-2 border">Planned Interval (m)</th>
                                                  <th className="text-left p-2 border">Existing Progress</th>
                                                  <th className="text-left p-2 border">Enter Actuals</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {details[h.id].tasks[task].intervals.map((pi, idx) => {
                                                  const key = rowKey(h.id, task, pi.from_m, pi.to_m);
                                                  const state = inputs[key] || { from_m: pi.from_m, to_m: "", disabled: false };
                                                  const overlaps = (details[h.id].tasks[task].progress || []).filter(
                                                    (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
                                                  );
                                                  const fullyCovered = state.disabled;
                                                  return (
                                                    <tr key={key} className="hover:bg-white">
                                                      <td className="p-2 border whitespace-nowrap">{pi.from_m}–{pi.to_m}</td>
                                                          <td className="p-2 border">
                                                            {overlaps.length === 0 ? (
                                                              <span className="text-gray-500">None</span>
                                                            ) : (
                                                              overlaps.map((o, i) => (
                                                                <span key={o.id} className="inline-block mr-3">
                                                                  {o.from_m}–{o.to_m}
                                                                  <span className="text-gray-500"> {o.user_id === currentUserId ? "(you)" : `by ${o.name || o.email || String(o.user_id || "").slice(0, 8)}`}</span>
                                                                  {i < overlaps.length - 1 ? "," : ""}
                                                                </span>
                                                              ))
                                                            )}
                                                          </td>
                                                      <td className="p-2 border">
                                                        {fullyCovered ? (
                                                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">Complete</span>
                                                        ) : (
                              <div className="flex items-center gap-1 md:gap-2">
                                                            <input
                                                              type="number"
                                                              step="0.1"
                                                              maxLength={4}
                                                              inputMode="decimal"
                                className="input input-xs w-14 md:input-sm md:w-20 text-[10px] md:text-xs"
                                                              value={state.from_m}
                                                              onChange={(e) =>
                                                                setInputs((m) => ({ ...m, [key]: { ...state, from_m: e.target.value } }))
                                                              }
                                                            />
                                                            <span className="text-[10px] md:text-xs text-gray-500">to</span>
                                                            <input
                                                              type="number"
                                                              step="0.1"
                                                              maxLength={4}
                                                              inputMode="decimal"
                                className="input input-xs w-14 md:input-sm md:w-20 text-[10px] md:text-xs"
                                                              value={state.to_m}
                                                              placeholder={pi.to_m}
                                                              onChange={(e) =>
                                                                setInputs((m) => ({ ...m, [key]: { ...state, to_m: e.target.value } }))
                                                              }
                                                            />
                                                            <button
                                                              type="button"
                                className="btn btn-3d-primary text-[10px] md:text-xs shrink-0 whitespace-nowrap px-2"
                                                              onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m)}
                                                              disabled={savingKey === key}
                                                            >
                                                              {savingKey === key ? "Saving…" : "Save"}
                                                            </button>
                                                            <button
                                                              type="button"
                                className="btn btn-3d-glass text-[10px] md:text-xs shrink-0 whitespace-nowrap px-2"
                                                              onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m, state.from_m, pi.to_m)}
                                                              disabled={savingKey === key}
                                                            >
                                                              Fill to end
                                                            </button>
                                                          </div>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredHoles.map((h) => (
              <div key={h.id} data-core-hole-id={h.id} className={`card p-3 ${focusedHoleId === h.id ? "ring-1 ring-cyan-300/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700">Hole ID: {h.hole_id}</span>
                    <span className="text-gray-500">· Depth {h?.depth ?? "-"} m</span>
                  </div>
                  <span className={getStatusMeta(h.id).cls}>{getStatusMeta(h.id).label}</span>
                </div>
                <button
                  className="mt-2 w-full btn btn-3d-primary text-xs"
                  onClick={() => toggleHole(h.id)}
                >
                  {expandedHole[h.id] ? "Hide tasks" : "Show tasks"}
                </button>
                {expandedHole[h.id] && (
                  <div className="mt-2">
                    {!details[h.id] ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : Object.keys(details[h.id].tasks).length === 0 ? (
                      <p className="text-sm text-gray-500">No planned logging for this hole.</p>
                    ) : (
                      <div className="space-y-2">
                        {details[h.id].order.map((task) => (
                          <div key={task} className="glass rounded-xl">
                            <button
                              className="w-full p-2 text-xs flex items-center justify-between"
                              onClick={() => toggleTask(h.id, task)}
                              aria-expanded={!!expandedTask[holeKey(h.id, task)]}
                              aria-controls={`task-${h.id}-${task}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: taskColor(task) }} />
                                {taskLabel(task)}
                              </span>
                              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded bg-slate-900/70 text-slate-200 text-[11px]">
                                {expandedTask[holeKey(h.id, task)] ? '−' : '+'}
                              </span>
                            </button>
                            {expandedTask[holeKey(h.id, task)] && (
                              <div id={`task-${h.id}-${task}`} className="p-2 border-t space-y-2">
                                {details[h.id].tasks[task].intervals.map((pi) => {
                                  const key = rowKey(h.id, task, pi.from_m, pi.to_m);
                                  const state = inputs[key] || { from_m: pi.from_m, to_m: "", disabled: false };
                                  const overlaps = (details[h.id].tasks[task].progress || []).filter(
                                    (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
                                  );
                                  const fullyCovered = state.disabled;
                                  return (
                                    <div key={key} className="text-[11px] md:text-xs">
                                      <div className="text-gray-700 mb-1 text-[11px] md:text-xs">Planned {pi.from_m}–{pi.to_m} m</div>
                                      <div className="mb-1 text-[10px] md:text-[11px]">
                                        {overlaps.length === 0 ? (
                                          <span className="text-gray-500">No progress yet</span>
                                        ) : (
                                          overlaps.map((p, i) => (
                                            <span key={`${p.id}-${i}`} className="inline-block mr-2">
                                              {p.from_m}–{p.to_m} m by {p.name}
                                            </span>
                                          ))
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 md:gap-2">
                                        <input
                                          type="number"
                                          step="0.1"
                                          maxLength={4}
                                          inputMode="decimal"
                                          className="input input-xs w-8 md:input-sm md:w-20 text-[10px] md:text-xs"
                                          value={state.from_m}
                                          onChange={(e) => setInputs((m) => ({ ...m, [key]: { ...state, from_m: e.target.value } }))}
                                          disabled={state.disabled}
                                        />
                                        <span className="text-[10px] md:text-xs">to</span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          maxLength={4}
                                          inputMode="decimal"
                                          className="input input-xs w-8 md:input-sm md:w-20 text-[10px] md:text-xs"
                                          value={state.to_m}
                                          onChange={(e) => setInputs((m) => ({ ...m, [key]: { ...state, to_m: e.target.value } }))}
                                          disabled={state.disabled}
                                        />
                                        <button
                                          className="btn btn-3d-primary text-[10px] md:text-xs px-2"
                                          onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m)}
                                          disabled={state.disabled || savingKey === key}
                                        >
                                          {savingKey === key ? "Saving…" : fullyCovered ? "Saved" : "Save"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {/* 2) In your "Add New Core" modal form, add the Planned depth input */}
      <label className="flex flex-col gap-1.5 text-sm">
        Planned Depth (m)
        <input
          className="input"
          type="number"
          name="planned_depth"
          step="0.1"
          placeholder="e.g. 250.0"
          value={newHole.planned_depth}
          onChange={onNewHoleChange}
        />
      </label>
    </div>
    </div>
  );
}
