"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { parseTable } from "@/lib/parseTable";

const STATE_OPTIONS = ["proposed", "in_progress", "drilled"];
const DIAMETER_OPTIONS = ["", "NQ", "HQ", "PQ", "Other"];

function toNumOrNull(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export default function HoleDetailsTab() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [holes, setHoles] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [diameterFilter, setDiameterFilter] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState([]);

  const [selectedHole, setSelectedHole] = useState(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState({
    hole_id: "",
    depth: "",
    planned_depth: "",
    water_level_m: "",
    state: "proposed",
    drilling_diameter: "",
    drilling_contractor: "",
    project_id: "",
  });

  const sampleHeaders = useMemo(
    () =>
      "hole_id,depth,planned_depth,drilling_diameter\n" +
      "HOLE-001,150,200,NQ\n" +
      "HOLE-002,220,250,HQ\n",
    []
  );

  const loadData = async () => {
    if (!orgId) {
      setHoles([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [holesRes, projectsRes] = await Promise.all([
        supabase
          .from("holes")
          .select(
            "id,hole_id,depth,planned_depth,water_level_m,state,drilling_diameter,drilling_contractor,project_id,created_at,projects(name)"
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id,name").eq("organization_id", orgId).order("name", { ascending: true }),
      ]);

      if (holesRes.error) throw holesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setHoles(holesRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      toast.error(error?.message || "Failed to load hole details");
      setHoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filteredHoles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (holes || []).filter((hole) => {
      if (projectFilter && hole.project_id !== projectFilter) return false;
      if (stateFilter && hole.state !== stateFilter) return false;
      if (diameterFilter && hole.drilling_diameter !== diameterFilter) return false;

      if (!term) return true;

      return [
        hole.hole_id,
        hole.projects?.name,
        hole.drilling_contractor,
        hole.state,
        hole.drilling_diameter,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [holes, search, projectFilter, stateFilter, diameterFilter]);

  const openHole = (hole) => {
    setIsCreateMode(false);
    setSelectedHole(hole);
    setForm({
      hole_id: hole.hole_id || "",
      depth: hole.depth ?? "",
      planned_depth: hole.planned_depth ?? "",
      water_level_m: hole.water_level_m ?? "",
      state: hole.state || "proposed",
      drilling_diameter: hole.drilling_diameter || "",
      drilling_contractor: hole.drilling_contractor || "",
      project_id: hole.project_id || "",
    });
  };

  const closeHole = () => {
    if (saving) return;
    setIsCreateMode(false);
    setSelectedHole(null);
  };

  const openCreateHole = () => {
    setIsCreateMode(true);
    setSelectedHole({ id: null });
    setForm({
      hole_id: "",
      depth: "",
      planned_depth: "",
      water_level_m: "",
      state: "proposed",
      drilling_diameter: "",
      drilling_contractor: "",
      project_id: "",
    });
  };

  const saveHole = async () => {
    if (!selectedHole) return;
    if (!String(form.hole_id || "").trim()) {
      toast.error("Hole ID is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        hole_id: String(form.hole_id || "").trim(),
        depth: toNumOrNull(form.depth),
        planned_depth: toNumOrNull(form.planned_depth),
        water_level_m: toNumOrNull(form.water_level_m),
        state: form.state || "proposed",
        drilling_diameter: form.drilling_diameter || null,
        drilling_contractor: String(form.drilling_contractor || "").trim() || null,
        project_id: form.project_id || null,
      };

      const result = isCreateMode
        ? await supabase
            .from("holes")
            .insert({ ...payload, organization_id: orgId || null })
            .select("id")
            .single()
        : await supabase.from("holes").update(payload).eq("id", selectedHole.id);

      const { error } = result;
      if (error) throw error;

      toast.success(isCreateMode ? "Hole created" : "Hole details updated");
      await loadData();
      closeHole();
    } catch (error) {
      toast.error(error?.message || (isCreateMode ? "Failed to create hole" : "Failed to update hole"));
    } finally {
      setSaving(false);
    }
  };

  const onBulkUpload = async () => {
    const rows = parsed.length ? parsed : parseTable(bulkText);
    if (!rows.length) return toast.error("No rows found");

    const allowed = ["hole_id", "depth", "planned_depth", "drilling_diameter"];
    const invalid = Object.keys(rows[0] || {}).filter((key) => !allowed.includes(key));
    if (invalid.length) return toast.error(`Unexpected headers: ${invalid.join(", ")}`);

    const payloads = rows
      .map((row) => ({
        hole_id: String(row.hole_id || "").trim(),
        depth: toNumOrNull(row.depth),
        planned_depth: toNumOrNull(row.planned_depth),
        drilling_diameter: row.drilling_diameter || null,
        project_id: null,
        drilling_contractor: null,
        state: "proposed",
        organization_id: orgId || null,
      }))
      .filter((payload) => payload.hole_id);

    if (!payloads.length) return toast.error("No valid rows (missing hole_id)");

    setImporting(true);
    const { error } = await supabase.from("holes").insert(payloads);
    setImporting(false);

    if (error) return toast.error(error.message);

    toast.success(`Inserted ${payloads.length} holes`);
    setBulkText("");
    setParsed([]);
    setShowBulk(false);
    await loadData();
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Hole Details</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn hidden md:inline-flex"
            onClick={() => {
              setShowBulk(true);
              setParsed([]);
            }}
          >
            Open bulk uploader
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreateHole}>
            Add New Core
          </button>
        </div>
      </div>

      <div className="glass rounded-xl border border-white/10 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px] text-xs text-slate-300">
            Search
            <input
              className="input mt-1 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hole ID, project, contractor..."
            />
          </label>

          <label className="hidden md:flex md:items-center md:gap-2 text-xs text-slate-300">
            <span className="whitespace-nowrap">Project</span>
            <select className="select-gradient-sm h-10 min-w-[170px]" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="hidden md:flex md:items-center md:gap-2 text-xs text-slate-300">
            <span className="whitespace-nowrap">State</span>
            <select className="select-gradient-sm h-10 min-w-[150px]" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label className="hidden md:flex md:items-center md:gap-2 text-xs text-slate-300">
            <span className="whitespace-nowrap">Diameter</span>
            <select className="select-gradient-sm h-10 min-w-[150px]" value={diameterFilter} onChange={(e) => setDiameterFilter(e.target.value)}>
              <option value="">All diameters</option>
              {DIAMETER_OPTIONS.filter(Boolean).map((diameter) => (
                <option key={diameter} value={diameter}>
                  {diameter}
                </option>
              ))}
            </select>
          </label>

          <div className="w-full sm:w-auto sm:min-w-[120px]">
            <button
              type="button"
              className="btn h-10 w-full sm:w-auto sm:px-5"
              onClick={() => {
                setSearch("");
                setProjectFilter("");
                setStateFilter("");
                setDiameterFilter("");
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Hole ID</th>
              <th>Project</th>
              <th>State</th>
              <th>Depth</th>
              <th>Planned</th>
              <th>Diameter</th>
              <th>Contractor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-300">
                  Loading holes…
                </td>
              </tr>
            ) : filteredHoles.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-300">
                  No holes match your filters.
                </td>
              </tr>
            ) : (
              filteredHoles.map((hole) => (
                <tr
                  key={hole.id}
                  className="cursor-pointer hover:bg-white/5 transition-base"
                  onClick={() => openHole(hole)}
                >
                  <td className="font-medium">{hole.hole_id}</td>
                  <td>{hole.projects?.name || "—"}</td>
                  <td>{hole.state || "—"}</td>
                  <td>{hole.depth ?? "—"}</td>
                  <td>{hole.planned_depth ?? "—"}</td>
                  <td>{hole.drilling_diameter || "—"}</td>
                  <td>{hole.drilling_contractor || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedHole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl p-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">{isCreateMode ? "Add New Core" : "Edit Hole Details"}</h3>
              <button type="button" className="btn" onClick={closeHole} disabled={saving}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                Hole ID
                <input
                  className="input mt-1"
                  value={form.hole_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, hole_id: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                State
                <select
                  className="select-gradient-sm mt-1"
                  value={form.state}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                >
                  {STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Depth (m)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  value={form.depth}
                  onChange={(e) => setForm((prev) => ({ ...prev, depth: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Planned Depth (m)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  value={form.planned_depth}
                  onChange={(e) => setForm((prev) => ({ ...prev, planned_depth: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Water Level (m)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  value={form.water_level_m}
                  onChange={(e) => setForm((prev) => ({ ...prev, water_level_m: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Diameter
                <select
                  className="select-gradient-sm mt-1"
                  value={form.drilling_diameter}
                  onChange={(e) => setForm((prev) => ({ ...prev, drilling_diameter: e.target.value }))}
                >
                  {DIAMETER_OPTIONS.map((diameter) => (
                    <option key={diameter || "none"} value={diameter}>
                      {diameter || "Select..."}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Drilling Contractor
                <input
                  className="input mt-1"
                  value={form.drilling_contractor}
                  onChange={(e) => setForm((prev) => ({ ...prev, drilling_contractor: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Project
                <select
                  className="select-gradient-sm mt-1"
                  value={form.project_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, project_id: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={closeHole} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveHole} disabled={saving}>
                {saving ? "Saving…" : isCreateMode ? "Add Hole" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    const value = e.target.value;
                    setBulkText(value);
                    try {
                      setParsed(parseTable(value));
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
                      {(parsed || []).slice(0, 200).map((row, index) => (
                        <tr key={index}>
                          <td>{row.hole_id}</td>
                          <td>{row.depth}</td>
                          <td>{row.planned_depth}</td>
                          <td>{row.drilling_diameter}</td>
                        </tr>
                      ))}
                      {parsed.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-sm text-gray-500">Paste data to preview</td>
                        </tr>
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
    </div>
  );
}
