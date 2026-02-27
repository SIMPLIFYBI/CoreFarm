"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

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
  const [tenements, setTenements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [diameterFilter, setDiameterFilter] = useState("");

  const [selectedHole, setSelectedHole] = useState(null);
  const [form, setForm] = useState({
    hole_id: "",
    depth: "",
    planned_depth: "",
    water_level_m: "",
    state: "proposed",
    drilling_diameter: "",
    drilling_contractor: "",
    project_id: "",
    tenement_id: "",
  });

  const loadData = async () => {
    if (!orgId) {
      setHoles([]);
      setProjects([]);
      setTenements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [holesRes, projectsRes, tenementsRes] = await Promise.all([
        supabase
          .from("holes")
          .select(
            "id,hole_id,depth,planned_depth,water_level_m,state,drilling_diameter,drilling_contractor,project_id,tenement_id,created_at,projects(name),tenements(tenement_id)"
          )
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id,name").eq("organization_id", orgId).order("name", { ascending: true }),
        supabase
          .from("tenements")
          .select("id,tenement_id")
          .eq("organization_id", orgId)
          .order("tenement_id", { ascending: true }),
      ]);

      if (holesRes.error) throw holesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (tenementsRes.error) throw tenementsRes.error;

      setHoles(holesRes.data || []);
      setProjects(projectsRes.data || []);
      setTenements(tenementsRes.data || []);
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
        hole.tenements?.tenement_id,
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
      tenement_id: hole.tenement_id || "",
    });
  };

  const closeHole = () => {
    if (saving) return;
    setSelectedHole(null);
  };

  const saveHole = async () => {
    if (!selectedHole?.id) return;
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
        tenement_id: form.tenement_id || null,
      };

      const { error } = await supabase.from("holes").update(payload).eq("id", selectedHole.id);
      if (error) throw error;

      toast.success("Hole details updated");
      await loadData();
      closeHole();
    } catch (error) {
      toast.error(error?.message || "Failed to update hole");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Hole Details</h2>
      </div>

      <div className="glass rounded-xl border border-white/10 p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="text-xs text-slate-300 xl:col-span-1">
            Search
            <input
              className="input mt-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hole ID, project, contractor..."
            />
          </label>

          <label className="text-xs text-slate-300 xl:col-span-1">
            Project
            <select className="select-gradient-sm mt-1" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300 xl:col-span-1">
            State
            <select className="select-gradient-sm mt-1" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300 xl:col-span-1">
            Diameter
            <select className="select-gradient-sm mt-1" value={diameterFilter} onChange={(e) => setDiameterFilter(e.target.value)}>
              <option value="">All diameters</option>
              {DIAMETER_OPTIONS.filter(Boolean).map((diameter) => (
                <option key={diameter} value={diameter}>
                  {diameter}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end xl:justify-end">
            <button
              type="button"
              className="btn btn-xs w-full xl:w-auto"
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
              <h3 className="text-lg font-semibold text-slate-100">Edit Hole Details</h3>
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

              <label className="text-sm">
                Tenement
                <select
                  className="select-gradient-sm mt-1"
                  value={form.tenement_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, tenement_id: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {tenements.map((tenement) => (
                    <option key={tenement.id} value={tenement.id}>
                      {tenement.tenement_id}
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
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
