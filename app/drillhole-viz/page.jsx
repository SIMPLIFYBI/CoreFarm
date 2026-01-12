"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";

export default function DrillholeVizPage() {
  const supabase = supabaseBrowser();
  const { orgId: selectedOrgId, memberships } = useOrg();

  const myRole = useMemo(() => {
    const m = (memberships || []).find((m) => m.organization_id === selectedOrgId);
    // accept either shape: { role } or { organization_role }
    return m?.organization_role ?? m?.role ?? null;
  }, [memberships, selectedOrgId]);

  const [loading, setLoading] = useState(true);
  const [holes, setHoles] = useState([]);
  const [selectedHoleId, setSelectedHoleId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState("hole");
  const [expandedProjects, setExpandedProjects] = useState({});

  // Planned depth editor (existing)
  const [plannedDepthInput, setPlannedDepthInput] = useState("");
  const [savingPlannedDepth, setSavingPlannedDepth] = useState(false);

  // Types (existing)
  const [lithologyTypesAll, setLithologyTypesAll] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesSaving, setTypesSaving] = useState(false);

  // ADD: Geology editor state (this fixes setGeoRows not defined)
  const [geoRows, setGeoRows] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoSaving, setGeoSaving] = useState(false);

  // Roles in schema are admin/member (no editor). Keep this permissive; RLS will enforce actual rights.
  const canEdit = myRole === "admin" || myRole === "member";

  // Keep ONLY this selectedHole definition (delete the later duplicate)
  const selectedHole = useMemo(() => {
    return (holes || []).find((h) => h.id === selectedHoleId) || null;
  }, [holes, selectedHoleId]);

  // ADD THIS: group holes by project for the Hole tab
  const projects = useMemo(() => {
    const map = new Map();
    (holes || []).forEach((h) => {
      const pid = h.project_id || "no_project";
      if (!map.has(pid)) {
        map.set(pid, {
          project_id: pid,
          name: h.projects?.name || "No project",
          holes: [],
        });
      }
      map.get(pid).holes.push(h);
    });

    // sort projects and holes
    const arr = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    arr.forEach((p) => p.holes.sort((a, b) => String(a.hole_id || "").localeCompare(String(b.hole_id || ""))));
    return arr;
  }, [holes]);

  // REPLACE your lithById memo to use lithologyTypesAll
  const lithById = useMemo(() => {
    const m = new Map();
    for (const t of lithologyTypesAll || []) m.set(t.id, t);
    return m;
  }, [lithologyTypesAll]);

  // ADD: active-only list used by Geology picker
  const lithologyTypesActive = useMemo(() => {
    return (lithologyTypesAll || []).filter((t) => t.is_active !== false);
  }, [lithologyTypesAll]);

  const roundToTenth = (v) => {
    if (v === "" || v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return Math.round(n * 10) / 10;
  };

  const validateAndNormalizeIntervals = (rows) => {
    const cleaned = (rows || [])
      .map((r) => {
        const from = roundToTenth(r.from_m);
        const to = roundToTenth(r.to_m);
        return {
          ...r,
          from_m: from,
          to_m: to,
          lithology_type_id: r.lithology_type_id || "",
          notes: r.notes || "",
        };
      })
      .filter((r) => r.from_m !== "" || r.to_m !== "" || r.lithology_type_id || r.notes);

    for (const r of cleaned) {
      if (r.from_m === "" || r.to_m === "") return { ok: false, message: "All intervals need From and To." };
      if (!r.lithology_type_id) return { ok: false, message: "All intervals need a lithology type." };
      if (r.from_m < 0 || r.to_m < 0) return { ok: false, message: "Depths must be ≥ 0." };
      if (!(r.from_m < r.to_m)) return { ok: false, message: "Each interval must have From < To." };
    }

    const sorted = [...cleaned].sort((a, b) => a.from_m - b.from_m);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      // using [from,to) semantics like your numrange defaults
      if (cur.from_m < prev.to_m) {
        return {
          ok: false,
          message: `Intervals overlap: ${prev.from_m}-${prev.to_m} overlaps ${cur.from_m}-${cur.to_m}.`,
        };
      }
    }

    return { ok: true, rows: sorted };
  };

  const reloadLithologyTypes = async () => {
    if (!selectedOrgId) {
      setLithologyTypesAll([]);
      return;
    }
    setTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_lithology_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", selectedOrgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    setTypesLoading(false);

    if (error) {
      console.error(error);
      toast.error("Could not load lithology types");
      setLithologyTypesAll([]);
      return;
    }

    setLithologyTypesAll(
      (data || []).map((t) => ({
        id: t.id,
        name: t.name || "",
        color: t.color || "#64748b",
        sort_order: t.sort_order ?? 0,
        is_active: t.is_active !== false,
      }))
    );
  };

  // REPLACE your existing "Load lithology types" effect with this
  useEffect(() => {
    reloadLithologyTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  // ADD: Types CRUD helpers (fixes addLithologyTypeRow not defined)
  const addLithologyTypeRow = () => {
    setLithologyTypesAll((prev) => [
      ...(prev || []),
      {
        id: null,
        name: "",
        color: "#64748b",
        sort_order: (prev?.length || 0) + 1,
        is_active: true,
      },
    ]);
  };

  const updateLithologyTypeRow = (idx, patch) => {
    setLithologyTypesAll((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const deleteLithologyType = async (idx) => {
    const row = lithologyTypesAll?.[idx];
    if (!row) return;

    // Unsaved row: remove locally
    if (!row.id) {
      setLithologyTypesAll((prev) => {
        const next = [...(prev || [])];
        next.splice(idx, 1);
        return next;
      });
      return;
    }

    if (!confirm(`Delete lithology type "${row.name || "Unnamed"}"?`)) return;

    const { error } = await supabase.from("drillhole_lithology_types").delete().eq("id", row.id);
    if (error) {
      console.error(error);
      toast.error(error.message || "Could not delete type");
      return;
    }

    toast.success("Type deleted");
    await reloadLithologyTypes();
  };

  const saveLithologyTypes = async () => {
    if (!selectedOrgId) return;

    const cleaned = (lithologyTypesAll || []).map((t) => ({
      ...t,
      name: String(t.name || "").trim(),
      color: t.color || "#64748b",
      sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : 0,
      is_active: t.is_active !== false,
    }));

    if (cleaned.some((t) => !t.name)) {
      toast.error("All lithology types need a name (or delete the blank row).");
      return;
    }

    try {
      setTypesSaving(true);

      const inserts = cleaned
        .filter((t) => !t.id)
        .map((t) => ({
          organization_id: selectedOrgId,
          name: t.name,
          color: t.color,
          sort_order: t.sort_order,
          is_active: t.is_active,
        }));

      if (inserts.length) {
        const { error } = await supabase.from("drillhole_lithology_types").insert(inserts);
        if (error) throw error;
      }

      // Update existing
      for (const t of cleaned.filter((x) => !!x.id)) {
        const { error } = await supabase
          .from("drillhole_lithology_types")
          .update({
            name: t.name,
            color: t.color,
            sort_order: t.sort_order,
            is_active: t.is_active,
          })
          .eq("id", t.id);
        if (error) throw error;
      }

      toast.success("Lithology types saved");
      await reloadLithologyTypes();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save lithology types");
    } finally {
      setTypesSaving(false);
    }
  };

  // Load geology intervals when hole changes
  useEffect(() => {
    if (!selectedOrgId || !selectedHoleId) {
      setGeoRows([]);
      return;
    }
    (async () => {
      setGeoLoading(true);
      const { data, error } = await supabase
        .from("drillhole_geology_intervals")
        .select("id, from_m, to_m, lithology_type_id, notes, created_at")
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      setGeoLoading(false);

      if (error) {
        console.error(error);
        toast.error("Could not load geology intervals");
        setGeoRows([]);
        return;
      }

      setGeoRows(
        (data || []).map((r) => ({
          id: r.id,
          from_m: r.from_m ?? "",
          to_m: r.to_m ?? "",
          lithology_type_id: r.lithology_type_id || "",
          notes: r.notes || "",
        }))
      );
    })();
  }, [selectedOrgId, selectedHoleId, supabase]);

  const addGeoRow = () => {
    setGeoRows((prev) => [
      ...(prev || []),
      {
        id: null,
        from_m: "",
        to_m: "",
        // FIX: use lithologyTypesActive (lithologyTypes no longer exists)
        lithology_type_id: lithologyTypesActive?.[0]?.id || "",
        notes: "",
      },
    ]);
  };

  const updateGeoRow = (idx, patch) => {
    setGeoRows((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeGeoRow = (idx) => {
    setGeoRows((prev) => {
      const next = [...(prev || [])];
      next.splice(idx, 1);
      return next;
    });
  };

  const saveGeology = async () => {
    if (!selectedOrgId || !selectedHoleId) return;
    const v = validateAndNormalizeIntervals(geoRows);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }

    try {
      setGeoSaving(true);

      // Replace-all strategy (V1): delete then insert
      const { error: delErr } = await supabase
        .from("drillhole_geology_intervals")
        .delete()
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId);

      if (delErr) throw delErr;

      const payload = (v.rows || []).map((r) => ({
        organization_id: selectedOrgId,
        hole_id: selectedHoleId,
        lithology_type_id: r.lithology_type_id,
        from_m: r.from_m,
        to_m: r.to_m,
        notes: r.notes || null,
      }));

      if (payload.length) {
        const { error: insErr } = await supabase.from("drillhole_geology_intervals").insert(payload);
        if (insErr) throw insErr;
      }

      toast.success("Geology saved");

      // Reload to ensure we reflect DB ordering + IDs
      const { data, error } = await supabase
        .from("drillhole_geology_intervals")
        .select("id, from_m, to_m, lithology_type_id, notes")
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      if (!error) {
        setGeoRows(
          (data || []).map((r) => ({
            id: r.id,
            from_m: r.from_m ?? "",
            to_m: r.to_m ?? "",
            lithology_type_id: r.lithology_type_id || "",
            notes: r.notes || "",
          }))
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save geology");
    } finally {
      setGeoSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedOrgId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_id, depth, planned_depth, state, project_id, projects(name)")
        .eq("organization_id", selectedOrgId)
        .order("project_id", { ascending: true })
        .order("hole_id", { ascending: true });

      if (error) {
        console.error(error);
        toast.error("Could not load holes");
        setHoles([]);
        setLoading(false);
        return;
      }

      setHoles(data || []);
      setLoading(false);
    })();
  }, [supabase, selectedOrgId]);

  const canSeeTypesTab = myRole === "admin";

  // change this:
  // const canEditHole = myRole === "admin" || myRole === "editor";
  // to this:
  const canEditHole = canEdit;

  const onSelectHole = (holeId) => {
    setSelectedHoleId(holeId);
    setDrawerTab("attributes");
    setDrawerOpen(true);
  };

  const exportDisabledReason = useMemo(() => {
    if (!selectedHole) return "Select a hole";
    if (selectedHole.planned_depth == null || selectedHole.planned_depth === "") return "Set planned depth to export";
    const n = Number(selectedHole.planned_depth);
    if (!Number.isFinite(n) || n <= 0) return "Planned depth must be > 0";
    return "";
  }, [selectedHole]);

  const updatePlannedDepth = async () => {
    if (!selectedHole) return;

    // empty => null (unset)
    const trimmed = String(plannedDepthInput ?? "").trim();
    const next = trimmed === "" ? null : Number(trimmed);

    if (next !== null && (!Number.isFinite(next) || next <= 0)) {
      toast.error("Planned depth must be a number > 0 (or blank to unset).");
      return;
    }

    try {
      setSavingPlannedDepth(true);

      const { error } = await supabase
        .from("holes")
        .update({ planned_depth: next })
        .eq("id", selectedHole.id);

      if (error) throw error;

      // Update local list so UI reflects immediately
      setHoles((prev) =>
        (prev || []).map((h) => (h.id === selectedHole.id ? { ...h, planned_depth: next } : h))
      );

      toast.success("Planned depth saved");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Could not save planned depth");
    } finally {
      setSavingPlannedDepth(false);
    }
  };

  const onExportPdf = async () => {
    if (exportDisabledReason) {
      toast.error(exportDisabledReason);
      return;
    }
    toast("PDF export not wired yet (V1 next step).");
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      <div className="h-full flex">
        {/* Left drawer */}
        <div
          className={[
            "h-full border-r border-white/10 bg-slate-950/40 backdrop-blur",
            // CHANGED: wider drawer on desktop
            drawerOpen ? "w-[460px] xl:w-[520px] max-w-[92vw]" : "w-12",
            "transition-all duration-200 overflow-hidden",
          ].join(" ")}
        >
          <div className="h-full flex flex-col">
            {/* Drawer header */}
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <button
                type="button"
                className="btn text-xs px-2"
                onClick={() => setDrawerOpen((v) => !v)}
                title={drawerOpen ? "Collapse" : "Expand"}
              >
                {drawerOpen ? "◀" : "▶"}
              </button>
              {drawerOpen && (
                <div className="flex-1">
                  <div className="text-slate-100 font-semibold">Drillhole Viz</div>
                  <div className="text-[11px] text-slate-400">Org role: {myRole || "—"}</div>
                </div>
              )}
            </div>

            {/* Tabs */}
            {drawerOpen && (
              <div className="px-3 pt-3">
                <div className="flex gap-2 border-b border-white/10">
                  <TabButton active={drawerTab === "hole"} onClick={() => setDrawerTab("hole")} label="Hole" />
                  <TabButton
                    active={drawerTab === "attributes"}
                    onClick={() => setDrawerTab("attributes")}
                    label="Attributes"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />
                  {/* NEW */}
                  <TabButton
                    active={drawerTab === "geology"}
                    onClick={() => setDrawerTab("geology")}
                    label="Geology"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />

                  {canSeeTypesTab && (
                    <TabButton active={drawerTab === "types"} onClick={() => setDrawerTab("types")} label="Types" />
                  )}
                </div>
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-3">
              {!drawerOpen ? null : loading ? (
                <div className="text-sm text-slate-300">Loading…</div>
              ) : drawerTab === "hole" ? (
                // ...existing hole tab (projects.* now works) ...
                <div className="space-y-2">
                  {!selectedOrgId ? (
                    <div className="text-sm text-slate-300">Select an organization.</div>
                  ) : projects.length === 0 ? (
                    <div className="text-sm text-slate-300">No holes found.</div>
                  ) : (
                    projects.map((p) => {
                      const isOpen = !!expandedProjects[p.project_id];
                      return (
                        <div key={p.project_id} className="card p-2">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between text-left"
                            onClick={() => setExpandedProjects((m) => ({ ...m, [p.project_id]: !isOpen }))}
                          >
                            <div className="text-sm font-medium text-slate-100 truncate">{p.name}</div>
                            <div className="text-xs text-slate-400">
                              {p.holes.length} {p.holes.length === 1 ? "hole" : "holes"} {isOpen ? "−" : "+"}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="mt-2 space-y-1">
                              {p.holes.map((h) => {
                                const active = h.id === selectedHoleId;
                                return (
                                  <button
                                    key={h.id}
                                    type="button"
                                    className={[
                                      "w-full flex items-center justify-between rounded px-2 py-2 text-left border",
                                      active ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:bg-white/5",
                                    ].join(" ")}
                                    onClick={() => onSelectHole(h.id)}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm text-slate-100 truncate">{h.hole_id}</div>
                                      <div className="text-[11px] text-slate-400">
                                        State: {h.state || "—"} · Planned: {h.planned_depth ?? "—"}m · Actual: {h.depth ?? "—"}m
                                      </div>
                                    </div>
                                    <div className="text-slate-400 text-xs">Select</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : drawerTab === "attributes" ? (
                <div className="space-y-3">
                  {!selectedHole ? (
                    <div className="text-sm text-slate-300">Select a hole.</div>
                  ) : (
                    <>
                      <div className="card p-3">
                        <div className="text-sm font-medium text-slate-100">{selectedHole.hole_id}</div>
                        <div className="text-[11px] text-slate-400">
                          State: {selectedHole.state} · Planned: {selectedHole.planned_depth ?? "—"}m · Actual: {selectedHole.depth ?? "—"}m
                        </div>
                        {(selectedHole.planned_depth == null || selectedHole.planned_depth === "") && (
                          <div className="mt-2 text-[11px] text-amber-300">
                            PDF export requires Planned Depth to be set on the hole.
                          </div>
                        )}
                      </div>

                      {/* NEW: Planned depth editor */}
                      <div className="card p-3 space-y-2">
                        <div className="text-sm font-medium text-slate-100">Planned depth</div>

                        <div className="flex items-center gap-2">
                          <input
                            className="input flex-1"
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            value={plannedDepthInput}
                            onChange={(e) => setPlannedDepthInput(e.target.value)}
                            placeholder="e.g. 250.0"
                            disabled={!canEditHole || savingPlannedDepth}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={updatePlannedDepth}
                            disabled={!canEditHole || savingPlannedDepth}
                            title={!canEditHole ? "Insufficient role to edit" : "Save planned depth"}
                          >
                            {savingPlannedDepth ? "Saving…" : "Save"}
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Leave blank to unset. Used for PDF export + paging/clipping.
                        </div>
                      </div>

                      <div className="card p-3">
                        <div className="text-sm font-medium text-slate-100 mb-2">Data entry (V1)</div>
                        <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                          <li>Geology intervals (no overlap, 0.1m)</li>
                          <li>Construction intervals (no overlap)</li>
                          <li>Annulus intervals (no overlap)</li>
                          <li>Sensors (depth points)</li>
                        </ul>
                        <div className="mt-3 text-[11px] text-slate-400">
                          Next: wire CRUD forms to <code>drillhole_*_intervals</code> + <code>drillhole_sensors</code>.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : drawerTab === "geology" ? (
                // ADD: Geology tab UI
                <div className="space-y-3">
                  {!selectedHole ? (
                    <div className="text-sm text-slate-300">Select a hole.</div>
                  ) : (
                    <div className="card p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100">Geology intervals</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            Hole: <span className="text-slate-200">{selectedHole.hole_id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" className="btn btn-xs" onClick={addGeoRow} disabled={!canEdit}>
                            + Row
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={saveGeology}
                            disabled={!canEdit || geoSaving}
                          >
                            {geoSaving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>

                      {geoLoading ? (
                        <div className="text-sm text-slate-300">Loading geology…</div>
                      ) : lithologyTypesActive.length === 0 ? (
                        <div className="text-sm text-amber-300">
                          No active lithology types found for this org. Add/enable them in the <b>Types</b> tab.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(geoRows || []).length === 0 && (
                            <div className="text-xs text-slate-400 italic">No geology intervals yet.</div>
                          )}

                          {(geoRows || []).map((r, idx) => {
                            const t = r.lithology_type_id ? lithById.get(r.lithology_type_id) : null;
                            const swatch = t?.color || "#64748b";

                            return (
                              <div
                                key={r.id || `new-${idx}`}
                                className="rounded-lg border border-white/10 bg-white/[0.03] p-2"
                              >
                                <div
                                  className={[
                                    "grid gap-2 items-center",
                                    // CHANGED: modern responsive layout that won’t squash inputs
                                    "grid-cols-1",
                                    "md:grid-cols-[minmax(96px,1fr)_minmax(96px,1fr)_minmax(220px,2.2fr)_minmax(160px,2fr)_auto]",
                                  ].join(" ")}
                                >
                                  <input
                                    className="input input-xs w-full"
                                    type="number"
                                    step="0.1"
                                    placeholder="From (m)"
                                    value={r.from_m}
                                    disabled={!canEdit}
                                    onChange={(e) => updateGeoRow(idx, { from_m: e.target.value })}
                                  />
                                  <input
                                    className="input input-xs w-full"
                                    type="number"
                                    step="0.1"
                                    placeholder="To (m)"
                                    value={r.to_m}
                                    disabled={!canEdit}
                                    onChange={(e) => updateGeoRow(idx, { to_m: e.target.value })}
                                  />

                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="inline-block h-3 w-3 rounded-sm border border-white/20 shrink-0"
                                      style={{ backgroundColor: swatch }}
                                      title={t?.name || "Lithology color"}
                                    />
                                    <select
                                      className="select-gradient-sm w-full min-w-0"
                                      value={r.lithology_type_id || ""}
                                      disabled={!canEdit}
                                      onChange={(e) => updateGeoRow(idx, { lithology_type_id: e.target.value })}
                                    >
                                      <option value="">Lithology…</option>
                                      {lithologyTypesActive.map((lt) => (
                                        <option key={lt.id} value={lt.id}>
                                          {lt.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <input
                                    className="input input-xs w-full"
                                    type="text"
                                    placeholder="Notes"
                                    value={r.notes || ""}
                                    disabled={!canEdit}
                                    onChange={(e) => updateGeoRow(idx, { notes: e.target.value })}
                                  />

                                  <button
                                    type="button"
                                    className="btn btn-xs w-full md:w-auto"
                                    onClick={() => removeGeoRow(idx)}
                                    disabled={!canEdit}
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          <div className="text-[11px] text-slate-400">
                            Rules: From &lt; To, 0.1m precision, no overlaps (treated as [from,to)).
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : drawerTab === "types" ? (
                <div className="space-y-3">
                  <div className="card p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-100">Lithology types</div>
                        <div className="text-[11px] text-slate-400">
                          Used by Geology intervals. (Org role: {myRole || "—"})
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" className="btn btn-xs" onClick={addLithologyTypeRow} disabled={!canEdit}>
                          + Type
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={saveLithologyTypes}
                          disabled={!canEdit || typesSaving}
                        >
                          {typesSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>

                    {typesLoading ? (
                      <div className="text-sm text-slate-300">Loading types…</div>
                    ) : (
                      <div className="space-y-2">
                        {(lithologyTypesAll || []).length === 0 && (
                          <div className="text-xs text-slate-400 italic">No types yet. Click “+ Type”.</div>
                        )}

                        {(lithologyTypesAll || []).map((t, idx) => (
                          <div
                            key={t.id || `new-type-${idx}`}
                            className="rounded-lg border border-white/10 bg-white/[0.03] p-2"
                          >
                            {/* CHANGED: use flex layout that can wrap instead of fixed grid columns */}
                            <div className="flex flex-col gap-2 min-w-0 md:flex-row md:items-center">
                              {/* Name (flexes) */}
                              <input
                                className="input input-xs w-full min-w-0 md:flex-1"
                                placeholder="Name (e.g. Basalt)"
                                value={t.name}
                                disabled={!canEdit}
                                onChange={(e) => updateLithologyTypeRow(idx, { name: e.target.value })}
                              />

                              {/* Controls (wrap if needed, never overflow the drawer) */}
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {/* Color */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    className="input input-xs"
                                    type="color"
                                    value={t.color || "#64748b"}
                                    disabled={!canEdit}
                                    onChange={(e) => updateLithologyTypeRow(idx, { color: e.target.value })}
                                    title="Color"
                                    style={{ width: 42, padding: 2 }}
                                  />
                                </div>

                                {/* Sort order (force width even though .input sets width:100%) */}
                                <input
                                  className="input input-xs !w-[72px] !min-w-[72px] !max-w-[72px] text-center tabular-nums shrink-0"
                                  type="number"
                                  min={0}
                                  max={99}
                                  step={1}
                                  inputMode="numeric"
                                  placeholder="00"
                                  value={t.sort_order ?? 0}
                                  disabled={!canEdit}
                                  onChange={(e) => updateLithologyTypeRow(idx, { sort_order: e.target.value })}
                                  title="Sort order"
                                />

                                {/* Active */}
                                <label className="text-xs text-slate-300 flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={t.is_active !== false}
                                    disabled={!canEdit}
                                    onChange={(e) => updateLithologyTypeRow(idx, { is_active: e.target.checked })}
                                  />
                                  Active
                                </label>

                                {/* Delete */}
                                <button
                                  type="button"
                                  className="btn btn-xs px-2 shrink-0"
                                  onClick={() => deleteLithologyType(idx)}
                                  disabled={!canEdit}
                                  title="Delete"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500">
                      If delete fails, it’s likely because a type is referenced by geology intervals (FK) or RLS.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-300">Unknown tab: {drawerTab}</div>
              )}
            </div>
          </div>
        </div>

        {/* Main schematic area */}
        <div className="flex-1 h-full overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-slate-100 font-semibold truncate">
                  {selectedHole ? `Schematic: ${selectedHole.hole_id}` : "Schematic"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedHole ? "Scale preview (SVG V1)" : "Select a hole to begin"}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={onExportPdf}
                disabled={!!exportDisabledReason}
                title={exportDisabledReason || "Export PDF"}
              >
                Export PDF
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="card p-4">
                {!selectedHole ? (
                  <div className="text-sm text-slate-300">Select a hole to preview the scale.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    <div className="lg:col-span-1 space-y-2">
                      <DepthScalePreview
                        plannedDepth={selectedHole.planned_depth}
                        actualDepth={selectedHole.depth}
                      />
                    </div>

                    <div className="lg:col-span-2 space-y-2">
                      <div className="text-sm text-slate-200">Schematic viewport (placeholder)</div>
                      <div className="text-xs text-slate-400">
                        Next we’ll render tracks (geology mirrored, construction inner, annulus outer, sensors).
                        This scale always fits the max of planned vs actual so both marks are visible.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Note: This is a UI preview only (no interval rendering yet).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, disabled, title }) {
  return (
    <button
      type="button"
      className={[
        "px-3 py-2 -mb-px border-b-2 text-sm transition-colors",
        active ? "border-indigo-500 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

function DepthScalePreview({ plannedDepth, actualDepth }) {
  const planned = Number(plannedDepth);
  const actual = Number(actualDepth);

  const hasPlanned = Number.isFinite(planned) && planned > 0;
  const hasActual = Number.isFinite(actual) && actual > 0;

  const progressPct = useMemo(() => {
    if (!hasPlanned || !hasActual) return null;
    return Math.max(0, Math.min(999, (actual / planned) * 100));
  }, [hasPlanned, hasActual, actual, planned]);

  const overrunM = useMemo(() => {
    if (!hasPlanned || !hasActual) return null;
    return Math.max(0, actual - planned);
  }, [hasPlanned, hasActual, actual, planned]);

  // Always scale to the higher of planned vs actual (so both markers are visible)
  const maxDepth = useMemo(() => {
    const m = Math.max(hasPlanned ? planned : 0, hasActual ? actual : 0, 100);
    return Math.ceil(m / 50) * 50; // round up to nearest 50m for nicer ticks
  }, [planned, actual, hasPlanned, hasActual]);

  const H = 520;
  const W = 160;
  const padTop = 20;
  const padBottom = 30;
  const barX = 90;
  const barW = 22;

  const yForDepth = (d) => {
    const clamped = Math.max(0, Math.min(maxDepth, d));
    const t = clamped / maxDepth;
    return padTop + t * (H - padTop - padBottom);
  };

  const plannedY = hasPlanned ? yForDepth(planned) : null;
  const actualY = hasActual ? yForDepth(actual) : null;

  const tickEvery = 10;
  const labelEvery = 50;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-slate-100">Depth scale</div>
        <div className="text-[11px] text-slate-400">0 → {maxDepth}m</div>
      </div>

      <div className="text-[11px] text-slate-300">
        Planned: <span className="text-slate-100">{hasPlanned ? `${planned}m` : "—"}</span>{" "}
        · Actual: <span className="text-slate-100">{hasActual ? `${actual}m` : "—"}</span>{" "}
        {progressPct != null && (
          <>
            · Progress: <span className="text-slate-100">{progressPct.toFixed(1)}%</span>
          </>
        )}
        {overrunM != null && overrunM > 0 && (
          <>
            {" "}
            · Overrun: <span className="text-amber-300">{overrunM.toFixed(1)}m</span>
          </>
        )}
      </div>

      {!hasPlanned && (
        <div className="text-[11px] text-amber-300">
          Planned depth is not set. Hatched “beyond planned” can’t be shown until planned depth exists.
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="10" fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.10)" />

        <line x1="50" y1={padTop} x2="50" y2={H - padBottom} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

        {Array.from({ length: Math.floor(maxDepth / tickEvery) + 1 }, (_, i) => i * tickEvery).map((d) => {
          const y = yForDepth(d);
          const isLabel = d % labelEvery === 0;
          return (
            <g key={d}>
              <line
                x1={isLabel ? 42 : 46}
                y1={y}
                x2={50}
                y2={y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={isLabel ? 1.2 : 1}
              />
              {isLabel && (
                <text x="10" y={y + 4} fontSize="10" fill="rgba(226,232,240,0.85)">
                  {d}m
                </text>
              )}
            </g>
          );
        })}

        {hasPlanned && (
          <g>
            <rect x={barX} y={padTop} width={barW} height={plannedY - padTop} rx="6" fill="rgba(99,102,241,0.55)" stroke="rgba(99,102,241,0.95)" />
            <line x1={barX - 10} y1={plannedY} x2={barX + barW + 10} y2={plannedY} stroke="rgba(99,102,241,0.95)" strokeWidth="1.5" />
            <text x={barX + barW + 14} y={plannedY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Planned: {planned}m
            </text>
          </g>
        )}

        {hasActual && (
          <g>
            <line x1={barX + barW / 2} y1={padTop} x2={barX + barW / 2} y2={actualY} stroke="rgba(16,185,129,0.9)" strokeWidth="2" />
            <line x1={barX - 10} y1={actualY} x2={barX + barW + 10} y2={actualY} stroke="rgba(16,185,129,0.95)" strokeWidth="1.5" />
            <text x={barX + barW + 14} y={actualY + 4} fontSize="10" fill="rgba(226,232,240,0.9)">
              Actual: {actual}m
            </text>
          </g>
        )}

        {hasPlanned && hasActual && actual > planned && (
          <rect x={barX} y={plannedY} width={barW} height={actualY - plannedY} rx="6" fill="url(#hatch)" stroke="rgba(255,255,255,0.25)" />
        )}
      </svg>

      <div className="text-[11px] text-slate-400">Blue = planned. Green = actual. Hatched = beyond plan.</div>
    </div>
  );
}