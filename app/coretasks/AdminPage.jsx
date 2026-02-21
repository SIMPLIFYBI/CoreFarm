"use client";

import { useEffect, useMemo, useState, Fragment, useRef } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { parseTable } from "@/lib/parseTable";

const TASK_TYPES = [
  "orientation",
  "magnetic_susceptibility",
  "whole_core_sampling",
  "cutting",
  "rqd",
  "specific_gravity",
];

export function AdminPage() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [holes, setHoles] = useState([]);
  const [holeStatus, setHoleStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [user, setUser] = useState(null);
  const [savingHole, setSavingHole] = useState(false);

  const [single, setSingle] = useState({
    hole_id: "",
    depth: "",
    planned_depth: "",
    drilling_diameter: "",
    project_id: "",
    drilling_contractor: "",
  });

  const [showHoleModal, setShowHoleModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Bulk upload modal state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [importing, setImporting] = useState(false);

  const [selectedProject, setSelectedProject] = useState("");
  const [holeFilters, setHoleFilters] = useState(["complete", "in_progress", "not_started"]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef(null);

  const [intervals, setIntervals] = useState({});
  const emptyIntervals = useMemo(
    () => TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), {}),
    []
  );

  const sampleHeaders = useMemo(
    () =>
      "hole_id,depth,planned_depth,drilling_diameter\n" +
      "HOLE-001,150,200,NQ\n" +
      "HOLE-002,220,250,HQ\n",
    []
  );

  const projects = useMemo(() => {
    const set = new Set();
    (holes || []).forEach((h) => {
      if (h.projects?.name) set.add(h.projects.name);
    });
    return Array.from(set).sort();
  }, [holes]);

  const classifyHole = (h) => {
    const s = holeStatus[h.id] || {};
    if (s.hasPlanned) {
      if (s.complete) return "complete";
      if (s.hasProgress) return "in_progress";
      return "not_started";
    }
    return s.hasProgress ? "in_progress" : "not_started";
  };

  const filteredHoles = useMemo(() => {
    const byProject = !selectedProject
      ? holes
      : (holes || []).filter((h) => h.projects?.name === selectedProject);
    const active = holeFilters || [];
    if (active.length === 0 || active.length === 3) return byProject;
    return byProject.filter((h) => active.includes(classifyHole(h)));
  }, [holes, selectedProject, holeFilters, holeStatus]);

  const toggleStatusFilter = (status) => {
    setHoleFilters((prev) => {
      const exists = prev.includes(status);
      let next = exists ? prev.filter((s) => s !== status) : [...prev, status];
      if (next.length === 0) next = ["complete", "in_progress", "not_started"];
      return next;
    });
  };

  const allSelected = holeFilters.length === 3;

  const getStatusMeta = (h) => {
    const status = classifyHole(h);
    if (status === "complete") return { label: "Completed", cls: "badge badge-green" };
    if (status === "in_progress") return { label: "In Progress", cls: "badge badge-amber" };
    return { label: "Not Started", cls: "badge badge-gray" };
  };

  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const reloadHoles = async () => {
    if (!orgId) {
      setHoles([]);
      setHoleStatus({});
      return;
    }
    const { data, error } = await supabase
      .from("holes")
      .select(
        "id, hole_id, depth, planned_depth, drilling_diameter, project_id, drilling_contractor, created_at, organization_id, projects(name)"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setHoles([]);
      setHoleStatus({});
      return;
    }

    const nextHoles = data || [];
    setHoles(nextHoles);

    const ids = nextHoles.map((h) => h.id);
    if (!ids.length) {
      setHoleStatus({});
      return;
    }

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

      const complete = planned.length
        ? planned.every((pi) => {
            const overlaps = (byTask[pi.task_type] || [])
              .filter((p) => Math.max(0, Math.min(Number(pi.to_m), Number(p.to_m)) - Math.max(Number(pi.from_m), Number(p.from_m))) > 0)
              .sort((a, b) => Number(a.from_m) - Number(b.from_m));
            let cursor = Number(pi.from_m);
            for (const p of overlaps) {
              if (Number(p.from_m) > cursor) break;
              if (Number(p.to_m) > cursor) cursor = Number(p.to_m);
            }
            return cursor >= Number(pi.to_m);
          })
        : false;

      statusMap[id] = {
        hasPlanned: planned.length > 0,
        complete,
        hasProgress: progArr.length > 0,
      };
    });
    setHoleStatus(statusMap);
  };

  // Load user
  useEffect(() => {
    let sub;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);

      const { data: s } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user || null);
      });
      sub = s?.subscription;
    })();

    return () => sub?.unsubscribe?.();
  }, [supabase]);

  // Load holes for current org
  useEffect(() => {
    if (!orgId) {
      setHoles([]);
      setHoleStatus({});
      return;
    }
    setLoading(true);
    (async () => {
      await reloadHoles();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!statusMenuOpen && !projectMenuOpen) return;
    const handler = (e) => {
      if (statusMenuOpen && statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuOpen(false);
      }
      if (projectMenuOpen && projectMenuRef.current && !projectMenuRef.current.contains(e.target)) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusMenuOpen, projectMenuOpen]);

  // Load intervals when selecting a hole
  useEffect(() => {
    if (!selectedId) return;

    (async () => {
      const { data, error } = await supabase
        .from("hole_task_intervals")
        .select("id, task_type, from_m, to_m")
        .eq("hole_id", selectedId)
        .order("from_m", { ascending: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      const grouped = TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), {});
      for (const row of data || []) {
        if (!grouped[row.task_type]) grouped[row.task_type] = [];
        grouped[row.task_type].push({ id: row.id, from_m: row.from_m, to_m: row.to_m });
      }
      setIntervals(grouped);
    })();
  }, [selectedId, supabase]);

  const selectHole = (h) => {
    setSelectedId(h.id);
    setSingle({
      hole_id: h.hole_id || "",
      depth: h.depth ?? "",
      planned_depth: h.planned_depth ?? "",
      drilling_diameter: h.drilling_diameter || "",
      project_id: h.project_id || "",
      drilling_contractor: h.drilling_contractor || "",
    });
    setIntervals(emptyIntervals);
  };

  const toggleExpandHole = (h) => {
    if (selectedId === h.id) {
      setSelectedId(null);
      setIntervals(emptyIntervals);
      return;
    }
    selectHole(h);
  };

  const onChangeSingle = (e) => {
    const { name, value } = e.target;
    setSingle((s) => ({ ...s, [name]: value }));
  };

  const saveSingle = async () => {
    try {
      if (!user) return toast.error("Sign in required to save");

      const idTrim = String(single.hole_id || "").trim();
      if (!idTrim) return toast.error("Hole ID is required");

      const payload = {
        hole_id: idTrim,
        depth: toNumOrNull(single.depth),
        planned_depth: toNumOrNull(single.planned_depth),
        drilling_diameter: single.drilling_diameter || null,
        project_id: single.project_id || null,
        drilling_contractor: single.drilling_contractor || null,
        organization_id: orgId || null,
      };

      setSavingHole(true);

      const res = editingId
        ? await supabase
            .from("holes")
            .update({
              hole_id: payload.hole_id,
              depth: payload.depth,
              planned_depth: payload.planned_depth,
              drilling_diameter: payload.drilling_diameter,
              project_id: payload.project_id,
              drilling_contractor: payload.drilling_contractor,
            })
            .eq("id", editingId)
            .select()
            .single()
        : await supabase.from("holes").insert(payload).select().single();

      if (res.error) throw res.error;

      toast.success(editingId ? "Hole updated" : "Hole created");
      await reloadHoles();

      setSelectedId(res.data.id);
      setIntervals(emptyIntervals);
      setShowHoleModal(false);
      setEditingId(null);
    } catch (e) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSavingHole(false);
    }
  };

  const onBulkUpload = async () => {
    const rows = parsed.length ? parsed : parseTable(bulkText);
    if (!rows.length) return toast.error("No rows found");

    const allowed = ["hole_id", "depth", "planned_depth", "drilling_diameter"];
    const invalid = Object.keys(rows[0] || {}).filter((k) => !allowed.includes(k));
    if (invalid.length) return toast.error(`Unexpected headers: ${invalid.join(", ")}`);

    const payloads = rows
      .map((r) => ({
        hole_id: String(r.hole_id || "").trim(),
        depth: toNumOrNull(r.depth),
        planned_depth: toNumOrNull(r.planned_depth),
        drilling_diameter: r.drilling_diameter || null,
        project_id: null,
        drilling_contractor: null,
        organization_id: orgId || null,
      }))
      .filter((p) => p.hole_id);

    if (!payloads.length) return toast.error("No valid rows (missing hole_id)");

    setImporting(true);
    const { error } = await supabase.from("holes").insert(payloads);
    setImporting(false);

    if (error) return toast.error(error.message);

    toast.success(`Inserted ${payloads.length} holes`);
    setBulkText("");
    setParsed([]);
    setShowBulk(false);
    await reloadHoles();
  };

  // Interval helpers
  const addInterval = (taskType) => {
    setIntervals((prev) => ({
      ...prev,
      [taskType]: [...(prev[taskType] || []), { from_m: "", to_m: "" }],
    }));
  };

  const changeInterval = (taskType, idx, field, value) => {
    setIntervals((prev) => {
      const arr = [...(prev[taskType] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [taskType]: arr };
    });
  };

  const removeInterval = (taskType, idx) => {
    setIntervals((prev) => {
      const arr = [...(prev[taskType] || [])];
      arr.splice(idx, 1);
      return { ...prev, [taskType]: arr };
    });
  };

  const saveIntervals = async () => {
    if (!selectedId) return toast.error("Select a hole first");

    const rows = TASK_TYPES.flatMap((t) =>
      (intervals[t] || []).map((r) => ({
        hole_id: selectedId,
        task_type: t,
        from_m: parseFloat(r.from_m),
        to_m: parseFloat(r.to_m),
      }))
    ).filter((r) => Number.isFinite(r.from_m) && Number.isFinite(r.to_m));

    const { error: delErr } = await supabase.from("hole_task_intervals").delete().eq("hole_id", selectedId);
    if (delErr) return toast.error(delErr.message);

    if (rows.length) {
      const { error: insErr } = await supabase.from("hole_task_intervals").insert(rows);
      if (insErr) return toast.error(insErr.message);
    }

    toast.success("Intervals saved");
  };

  const deleteHole = async (id) => {
    if (!user) return toast.error("Sign in required");

    const hole = holes.find((h) => h.id === id);
    const label = hole?.hole_id ? `hole ${hole.hole_id}` : "this hole";
    if (!confirm(`Delete ${label}? This will also remove its planned tasks and actuals.`)) return;

    const { error } = await supabase.from("holes").delete().eq("id", id);
    if (error) return toast.error(error.message || "Failed to delete");

    toast.success("Hole deleted");
    setHoles((prev) => prev.filter((h) => h.id !== id));

    if (selectedId === id) {
      setSelectedId(null);
      setSingle({
        hole_id: "",
        depth: "",
        planned_depth: "",
        drilling_diameter: "",
        project_id: "",
        drilling_contractor: "",
      });
      setIntervals(emptyIntervals);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="card p-4 md:p-5">
        <h1 className="text-2xl font-semibold">Add Core</h1>
        <p className="text-sm text-slate-300 mt-1">Create drillholes and define task intervals in one workflow.</p>
      </div>

      {!user && (
        <div className="p-3 border rounded bg-yellow-50 text-sm">
          You’re not signed in. Sign in on the Auth page to create or edit holes (RLS requires authentication).
        </div>
      )}

      <section className="card p-4 md:p-5">
        <div className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={projectMenuRef}>
            <button
              type="button"
              className="input input-sm w-auto flex items-center gap-1 cursor-pointer"
              onClick={() => setProjectMenuOpen((o) => !o)}
            >
              <span className="text-slate-200">Project:</span>
              <span className="text-slate-300 truncate max-w-[10rem]">{selectedProject || "All"}</span>
              <svg className={`w-3 h-3 ml-1 transition-transform ${projectMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0l-4.24-4.53a.75.75 0 01.02-1.06z" /></svg>
            </button>
            {projectMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-lg z-30 p-2 space-y-1 text-sm max-h-64 overflow-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedProject(""); setProjectMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60 text-left ${selectedProject === "" ? "bg-slate-900/60" : ""}`}
                >
                  <span className="flex-1">All projects</span>
                  <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${selectedProject === "" ? "text-indigo-300" : "text-transparent"}`}>✓</span>
                </button>
                {projects.map((p) => {
                  const active = selectedProject === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setSelectedProject(p); setProjectMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60 text-left ${active ? "bg-slate-900/60" : ""}`}
                    >
                      <span className="flex-1">{p}</span>
                      <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${active ? "text-indigo-300" : "text-transparent"}`}>✓</span>
                    </button>
                  );
                })}
                {selectedProject && (
                  <div className="pt-1 mt-1 border-t border-white/10">
                    <button
                      type="button"
                      className="text-[11px] text-slate-300 hover:underline"
                      onClick={() => { setSelectedProject(""); setProjectMenuOpen(false); }}
                    >Clear selection</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={statusMenuRef}>
            <button
              type="button"
              className="input input-sm w-auto flex items-center gap-1 cursor-pointer"
              onClick={() => setStatusMenuOpen((o) => !o)}
            >
              <span className="text-slate-200">Status:</span>
              <span className="flex items-center gap-1">
                {allSelected ? (
                  <span className="text-slate-300">All</span>
                ) : holeFilters.map((s) => {
                  const color = s === "complete" ? "bg-green-500" : s === "in_progress" ? "bg-amber-500" : "bg-gray-400";
                  return <span key={s} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-slate-900/60 border border-white/10">
                    <span className={`inline-block w-2 h-2 rounded-full ${color}`}></span>
                    {s === "complete" ? "Done" : s === "in_progress" ? "Progress" : "New"}
                  </span>;
                })}
              </span>
              <svg className={`w-3 h-3 ml-1 transition-transform ${statusMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0l-4.24-4.53a.75.75 0 01.02-1.06z" /></svg>
            </button>
            {statusMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-lg z-30 p-2 space-y-1 text-sm">
                {[
                  { key: "complete", label: "Completed", color: "bg-green-500" },
                  { key: "in_progress", label: "In progress", color: "bg-amber-500" },
                  { key: "not_started", label: "Not started", color: "bg-gray-400" },
                ].map((opt) => {
                  const active = holeFilters.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleStatusFilter(opt.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60 text-left ${active ? "bg-slate-900/60" : ""}`}
                    >
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${opt.color}`}></span>
                      <span className="flex-1">{opt.label}</span>
                      <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${active ? "text-indigo-300" : "text-transparent"}`}>✓</span>
                    </button>
                  );
                })}
                <div className="pt-1 mt-1 border-t border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-indigo-300 hover:underline"
                    onClick={() => setHoleFilters(["complete", "in_progress", "not_started"])}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-slate-300 hover:underline"
                    onClick={() => setHoleFilters([])}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          </div>

          <div className="flex items-start justify-end gap-3 lg:ml-3">
            <button
              type="button"
              onClick={() => {
                setShowBulk(true);
                setParsed([]);
              }}
              className="btn btn-3d-glass hidden md:inline-flex"
            >
              Open bulk uploader
            </button>
            <button
              type="button"
              className="btn btn-3d-primary"
              onClick={() => {
                setEditingId(null);
                setSingle({
                  hole_id: "",
                  depth: "",
                  planned_depth: "",
                  drilling_diameter: "",
                  project_id: "",
                  drilling_contractor: "",
                });
                setShowHoleModal(true);
              }}
            >
              Add New Core
            </button>
          </div>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : filteredHoles.length === 0 ? (
          <p className="text-sm text-slate-300">No holes match the selected filters.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Hole ID</th>
                  <th>Depth</th>
                  <th className="hidden md:table-cell">Planned</th>
                  <th className="hidden md:table-cell">Diameter</th>
                  <th className="hidden md:table-cell">Project</th>
                  <th className="hidden md:table-cell">Contractor</th>
                  <th className="hidden md:table-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHoles.map((h) => (
                  <Fragment key={h.id}>
                    <tr className={`${selectedId === h.id ? "row-selected" : ""}`}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => toggleExpandHole(h)}
                          title={selectedId === h.id ? "Collapse" : "Expand"}
                        >
                          {selectedId === h.id ? "−" : "+"}
                        </button>
                      </td>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{h.hole_id}</span>
                          <span className={getStatusMeta(h).cls}>{getStatusMeta(h).label}</span>
                        </div>
                      </td>
                      <td>{h.depth}</td>
                      <td className="hidden md:table-cell">{h.planned_depth ?? ""}</td>
                      <td className="hidden md:table-cell">{h.drilling_diameter}</td>
                      <td className="hidden md:table-cell">{h.projects?.name || ""}</td>
                      <td className="hidden md:table-cell">{h.drilling_contractor}</td>
                      <td className="hidden md:table-cell">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-3d-glass btn-xs"
                            onClick={() => {
                              setEditingId(h.id);
                              setSingle({
                                hole_id: h.hole_id || "",
                                depth: h.depth ?? "",
                                planned_depth: h.planned_depth ?? "",
                                drilling_diameter: h.drilling_diameter || "",
                                project_id: h.project_id || "",
                                drilling_contractor: h.drilling_contractor || "",
                              });
                              setShowHoleModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" className="btn btn-xs btn-danger" onClick={() => deleteHole(h.id)}>
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>

                    {selectedId === h.id && (
                      <tr className="bg-slate-900/35">
                        <td colSpan={8} className="p-0">
                          <div className="p-4 space-y-4 border-t">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-sm">Task intervals</h3>
                              <button type="button" className="btn btn-3d-primary btn-xs" onClick={saveIntervals} disabled={!selectedId}>
                                Save Tasks
                              </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              {TASK_TYPES.map((t) => (
                                <div key={t} className="glass rounded-xl p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs uppercase tracking-wide">
                                      {t.replace(/_/g, " ")}
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-3d-primary btn-xs shrink-0 w-20 text-[10px] justify-center"
                                      onClick={() => addInterval(t)}
                                      style={{ letterSpacing: "0.5px" }}
                                    >
                                      + Interval
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {(intervals[t] || []).map((row, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <input
                                          className="input input-xs w-8 md:w-20"
                                          placeholder="From"
                                          value={row.from_m}
                                          onChange={(e) => changeInterval(t, idx, "from_m", e.target.value)}
                                        />
                                        <span className="text-xs">→</span>
                                        <input
                                          className="input input-xs w-8 md:w-20"
                                          placeholder="To"
                                          value={row.to_m}
                                          onChange={(e) => changeInterval(t, idx, "to_m", e.target.value)}
                                        />
                                        <button type="button" className="btn btn-3d-glass btn-xs" onClick={() => removeInterval(t, idx)}>
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                    {!intervals[t]?.length && (
                                      <div className="text-xs text-gray-500 italic">None</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

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
      </section>

      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="card w-full max-w-5xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Bulk upload holes</h3>
              <button className="btn" onClick={() => setShowBulk(false)}>Close</button>
            </div>

            <div className="mb-3 text-sm font-bold text-red-700">
              Copy and paste must include the column header exactly the same as displayed below
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Paste CSV/TSV (first row headers)</label>
                <textarea
                  autoFocus
                  rows={10}
                  className="textarea font-mono"
                  placeholder={sampleHeaders}
                  value={bulkText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkText(v);
                    try {
                      setParsed(parseTable(v));
                    } catch {
                      setParsed([]);
                    }
                  }}
                />
                <div className="mt-2 text-xs text-gray-600">Tip: You can paste directly from Excel/Sheets; tabs are supported.</div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-gray-700">Preview</div>
                  <div className="text-xs text-gray-600">Rows: {parsed.length || 0}</div>
                </div>
                <div className="table-container" style={{ maxHeight: 320 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>hole_id</th>
                        <th>depth</th>
                        <th>planned_depth</th>
                        <th>drilling_diameter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(parsed || []).slice(0, 200).map((r, i) => (
                        <tr key={i}>
                          <td>{r.hole_id}</td>
                          <td>{r.depth}</td>
                          <td>{r.planned_depth}</td>
                          <td>{r.drilling_diameter}</td>
                        </tr>
                      ))}
                      {parsed.length === 0 && (
                        <tr><td colSpan={4} className="text-center text-sm text-gray-500">Paste data to preview</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onBulkUpload}
                className="btn btn-primary"
                disabled={importing || !parsed.length}
              >
                {importing ? "Importing…" : "Import"}
              </button>
              <button type="button" className="btn" onClick={() => { setBulkText(""); setParsed([]); }}>
                Clear
              </button>
              <div className="text-xs text-gray-600 ml-auto">
                Required: hole_id. Optional: depth, planned_depth, drilling_diameter.
              </div>
            </div>
          </div>
        </div>
      )}

      {showHoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Core" : "Add New Core"}</h2>
              <button className="btn" onClick={() => { setShowHoleModal(false); setEditingId(null); }}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <label className="block text-sm">
                Hole ID
                <input type="text" name="hole_id" value={single.hole_id} onChange={onChangeSingle} className="input" placeholder="HOLE-001" />
              </label>

              <label className="block text-sm">
                Depth (m)
                <input type="number" step="any" name="depth" value={single.depth} onChange={onChangeSingle} className="input" placeholder="e.g. 220" />
              </label>

              <label className="block text-sm">
                Planned Depth (m)
                <input type="number" step="0.1" name="planned_depth" value={single.planned_depth} onChange={onChangeSingle} className="input" placeholder="e.g. 250.0" />
              </label>

              <label className="block text-sm">
                Drilling Diameter
                <select name="drilling_diameter" value={single.drilling_diameter} onChange={onChangeSingle} className="select-gradient-sm">
                  <option value="">Select…</option>
                  <option value="NQ">NQ</option>
                  <option value="HQ">HQ</option>
                  <option value="PQ">PQ</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block text-sm">
                Project
                <ProjectSelect
                  supabase={supabase}
                  organizationId={orgId}
                  value={single.project_id}
                  onChange={(v) => setSingle((s) => ({ ...s, project_id: v }))}
                />
              </label>

              <label className="block text-sm">
                Drilling Contractor
                <input type="text" name="drilling_contractor" value={single.drilling_contractor} onChange={onChangeSingle} className="input" />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveSingle}
                disabled={savingHole || !single.hole_id || !user}
                className="btn btn-primary flex-1"
              >
                {savingHole ? "Saving…" : editingId ? "Save Changes" : "Add Hole"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingId(null);
                    setSingle({
                      hole_id: "",
                      depth: "",
                      planned_depth: "",
                      drilling_diameter: "",
                      project_id: "",
                      drilling_contractor: "",
                    });
                  }}
                >
                  New
                </button>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              After saving you can manage task intervals below the table.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSelect({ supabase, organizationId, value, onChange }) {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!organizationId) {
      setProjects([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name")
        .eq("organization_id", organizationId)
        .order("name");
      if (!error) setProjects(data || []);
    })();
  }, [organizationId, supabase]);

  return (
    <select
      className="select-gradient-sm"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Select…</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export default AdminPage;