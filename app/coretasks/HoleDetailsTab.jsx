"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { parseTable } from "@/lib/parseTable";

const STATE_OPTIONS = ["proposed", "in_progress", "drilled"];
const DIAMETER_OPTIONS = ["", "NQ", "HQ", "PQ", "Other"];
const COLLAR_SOURCE_OPTIONS = ["", "gps", "survey", "estimated", "imported"];
const COMPLETION_STATUS_OPTIONS = ["", "completed", "abandoned", "suspended"];
const BULK_COLUMNS = [
  { key: "hole_id", required: true, description: "Unique hole identifier." },
  { key: "depth", required: false, description: "Actual drilled depth (m)." },
  { key: "planned_depth", required: false, description: "Planned depth (m)." },
  { key: "water_level_m", required: false, description: "Water level from collar (m)." },
  { key: "azimuth", required: false, description: "0 <= azimuth < 360." },
  { key: "dip", required: false, description: "-90 to +90." },
  { key: "collar_longitude", required: false, description: "WGS84 longitude." },
  { key: "collar_latitude", required: false, description: "WGS84 latitude." },
  { key: "collar_elevation_m", required: false, description: "Collar elevation (m)." },
  { key: "collar_source", required: false, description: "gps/survey/estimated/imported." },
  { key: "started_at", required: false, description: "Datetime, e.g. 2026-03-01T06:00." },
  { key: "completed_at", required: false, description: "Datetime, e.g. 2026-03-02T18:00." },
  { key: "completion_status", required: false, description: "completed/abandoned/suspended." },
  { key: "completion_notes", required: false, description: "Free text." },
  { key: "drilling_diameter", required: false, description: "NQ/HQ/PQ/Other." },
  { key: "drilling_contractor", required: false, description: "Contractor name." },
];

function toNumOrNull(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toTextOrNull(value) {
  const txt = String(value || "").trim();
  return txt || null;
}

function toIsoOrNull(value) {
  const txt = String(value || "").trim();
  if (!txt) return null;
  const d = new Date(txt);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMeters(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(1)} m`;
}

function formatDegrees(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(1)}°`;
}

export default function HoleDetailsTab({ projectScope = "own" }) {
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
    azimuth: "",
    dip: "",
    collar_longitude: "",
    collar_latitude: "",
    collar_elevation_m: "",
    collar_source: "",
    started_at: "",
    completed_at: "",
    completion_status: "",
    completion_notes: "",
    state: "proposed",
    drilling_diameter: "",
    drilling_contractor: "",
    project_id: "",
  });

  const sampleHeaders = useMemo(
    () =>
      "hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,drilling_diameter,drilling_contractor\n" +
      "HOLE-001,150,200,12.5,135.0,-60.0,121.12345,-27.12345,385.2,gps,2026-03-01T06:00,2026-03-02T18:00,completed,Completed to planned depth,NQ,North Drilling\n" +
      "HOLE-002,220,250,18.0,142.5,-55.0,121.12510,-27.12430,388.1,survey,2026-03-03T07:30,2026-03-04T16:40,completed,Deviation survey complete,HQ,Westline Drilling\n" +
      "HOLE-003,80,180,,,,,,,,,,abandoned,Stopped due to poor ground conditions,PQ,\n",
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

        if (sharedProjectIds.length === 0) {
          setHoles([]);
          setProjects([]);
          return;
        }

        const { data: sharedHoles, error: holesErr } = await supabase
          .from("holes")
          .select(
            "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,drilling_diameter,drilling_contractor,project_id,created_at,organization_id,projects(name)"
          )
          .in("project_id", sharedProjectIds)
          .neq("organization_id", orgId)
          .order("created_at", { ascending: false });
        if (holesErr) throw holesErr;

        const projectMap = new Map();
        (sharedHoles || []).forEach((h) => {
          if (h.project_id && h.projects?.name) projectMap.set(h.project_id, h.projects.name);
        });

        setHoles(sharedHoles || []);
        setProjects(Array.from(projectMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const [holesRes, projectsRes] = await Promise.all([
          supabase
            .from("holes")
            .select(
              "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,drilling_diameter,drilling_contractor,project_id,created_at,projects(name)"
            )
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase.from("projects").select("id,name").eq("organization_id", orgId).order("name", { ascending: true }),
        ]);

        if (holesRes.error) throw holesRes.error;
        if (projectsRes.error) throw projectsRes.error;

        setHoles(holesRes.data || []);
        setProjects(projectsRes.data || []);
      }
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
  }, [orgId, projectScope]);

  useEffect(() => {
    setProjectFilter("");
    setSelectedHole(null);
    setIsCreateMode(false);
  }, [projectScope]);

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

  const bulkAllowedHeaders = useMemo(() => BULK_COLUMNS.map((c) => c.key), []);
  const bulkRequiredHeaders = useMemo(() => BULK_COLUMNS.filter((c) => c.required).map((c) => c.key), []);
  const bulkHeaderCsv = useMemo(() => BULK_COLUMNS.map((c) => c.key).join(","), []);
  const bulkHeaderTsv = useMemo(() => BULK_COLUMNS.map((c) => c.key).join("\t"), []);
  const bulkHeadersPresent = useMemo(() => Object.keys(parsed?.[0] || {}), [parsed]);

  const bulkInvalidHeaders = useMemo(
    () => bulkHeadersPresent.filter((header) => !bulkAllowedHeaders.includes(header)),
    [bulkHeadersPresent, bulkAllowedHeaders]
  );

  const bulkMissingRequired = useMemo(
    () => bulkRequiredHeaders.filter((header) => !bulkHeadersPresent.includes(header)),
    [bulkRequiredHeaders, bulkHeadersPresent]
  );

  const bulkValidRowsCount = useMemo(
    () => (parsed || []).filter((row) => String(row?.hole_id || "").trim()).length,
    [parsed]
  );

  const bulkCanImport =
    !importing &&
    parsed.length > 0 &&
    bulkInvalidHeaders.length === 0 &&
    bulkMissingRequired.length === 0 &&
    bulkValidRowsCount > 0;

  const copyBulkHeaders = async () => {
    const text = `${bulkHeaderTsv}\n`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Headers copied. Paste into Excel to create columns.");
    } catch {
      toast.error("Could not copy headers. You can use the sample text as a fallback.");
    }
  };

  const downloadBulkSample = () => {
    try {
      const csvContent = sampleHeaders.endsWith("\n") ? sampleHeaders : `${sampleHeaders}\n`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "holes_bulk_upload_sample.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Sample CSV downloaded");
    } catch {
      toast.error("Could not download sample CSV");
    }
  };

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
      collar_elevation_m: hole.collar_elevation_m ?? "",
      collar_source: hole.collar_source || "",
      started_at: toDateTimeLocal(hole.started_at),
      completed_at: toDateTimeLocal(hole.completed_at),
      completion_status: hole.completion_status || "",
      completion_notes: hole.completion_notes || "",
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
    if (projectScope === "shared") return;
    setIsCreateMode(true);
    setSelectedHole({ id: null });
    setForm({
      hole_id: "",
      depth: "",
      planned_depth: "",
      water_level_m: "",
      azimuth: "",
      dip: "",
      collar_longitude: "",
      collar_latitude: "",
      collar_elevation_m: "",
      collar_source: "",
      started_at: "",
      completed_at: "",
      completion_status: "",
      completion_notes: "",
      state: "proposed",
      drilling_diameter: "",
      drilling_contractor: "",
      project_id: "",
    });
  };

  const saveHole = async () => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    if (!selectedHole) return;
    if (!String(form.hole_id || "").trim()) {
      toast.error("Hole ID is required");
      return;
    }

    setSaving(true);
    try {
      const azimuth = toNumOrNull(form.azimuth);
      const dip = toNumOrNull(form.dip);
      const collarLongitude = toNumOrNull(form.collar_longitude);
      const collarLatitude = toNumOrNull(form.collar_latitude);
      const startedAt = toIsoOrNull(form.started_at);
      const completedAt = toIsoOrNull(form.completed_at);

      if (form.azimuth !== "" && azimuth == null) return toast.error("Azimuth must be a number");
      if (form.dip !== "" && dip == null) return toast.error("Dip must be a number");
      if (azimuth != null && (azimuth < 0 || azimuth >= 360)) return toast.error("Azimuth must be between 0 and < 360");
      if (dip != null && (dip < -90 || dip > 90)) return toast.error("Dip must be between -90 and 90");
      if ((collarLongitude == null) !== (collarLatitude == null)) return toast.error("Longitude and latitude must both be set or both blank");
      if (form.started_at && !startedAt) return toast.error("Started at is invalid");
      if (form.completed_at && !completedAt) return toast.error("Completed at is invalid");

      const payload = {
        hole_id: String(form.hole_id || "").trim(),
        depth: toNumOrNull(form.depth),
        planned_depth: toNumOrNull(form.planned_depth),
        water_level_m: toNumOrNull(form.water_level_m),
        azimuth,
        dip,
        collar_longitude: collarLongitude,
        collar_latitude: collarLatitude,
        collar_elevation_m: toNumOrNull(form.collar_elevation_m),
        collar_source: toTextOrNull(form.collar_source),
        started_at: startedAt,
        completed_at: completedAt,
        completion_status: toTextOrNull(form.completion_status),
        completion_notes: toTextOrNull(form.completion_notes),
        state: form.state || "proposed",
        drilling_diameter: form.drilling_diameter || null,
        drilling_contractor: toTextOrNull(form.drilling_contractor),
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
    if (projectScope === "shared") return toast.error("Bulk upload is disabled for client-shared holes");
    const rows = parsed.length ? parsed : parseTable(bulkText);
    if (!rows.length) return toast.error("No rows found");

    const invalid = Object.keys(rows[0] || {}).filter((key) => !bulkAllowedHeaders.includes(key));
    if (invalid.length) return toast.error(`Unexpected headers: ${invalid.join(", ")}`);

    const missing = bulkRequiredHeaders.filter((key) => !(key in (rows[0] || {})));
    if (missing.length) return toast.error(`Missing required headers: ${missing.join(", ")}`);

    const payloads = rows
      .map((row) => ({
        hole_id: String(row.hole_id || "").trim(),
        depth: toNumOrNull(row.depth),
        planned_depth: toNumOrNull(row.planned_depth),
        water_level_m: toNumOrNull(row.water_level_m),
        azimuth: toNumOrNull(row.azimuth),
        dip: toNumOrNull(row.dip),
        collar_longitude: toNumOrNull(row.collar_longitude),
        collar_latitude: toNumOrNull(row.collar_latitude),
        collar_elevation_m: toNumOrNull(row.collar_elevation_m),
        collar_source: toTextOrNull(row.collar_source),
        started_at: toIsoOrNull(row.started_at),
        completed_at: toIsoOrNull(row.completed_at),
        completion_status: toTextOrNull(row.completion_status),
        completion_notes: toTextOrNull(row.completion_notes),
        drilling_diameter: row.drilling_diameter || null,
        drilling_contractor: toTextOrNull(row.drilling_contractor),
        project_id: null,
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
            disabled={projectScope === "shared"}
            onClick={() => {
              setShowBulk(true);
              setParsed([]);
            }}
          >
            Open bulk uploader
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreateHole} disabled={projectScope === "shared"}>
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
              <th>Azimuth</th>
              <th>Diameter</th>
              <th>Contractor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-300">
                  Loading holes…
                </td>
              </tr>
            ) : filteredHoles.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-300">
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
                  <td>{formatMeters(hole.depth)}</td>
                  <td>{formatMeters(hole.planned_depth)}</td>
                  <td>{formatDegrees(hole.azimuth)}</td>
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
                Azimuth (deg)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  min="0"
                  max="359.9"
                  value={form.azimuth}
                  onChange={(e) => setForm((prev) => ({ ...prev, azimuth: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Dip (deg)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  min="-90"
                  max="90"
                  value={form.dip}
                  onChange={(e) => setForm((prev) => ({ ...prev, dip: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Collar Longitude (WGS84)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.000001"
                  value={form.collar_longitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_longitude: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Collar Latitude (WGS84)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.000001"
                  value={form.collar_latitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_latitude: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Collar Elevation (m)
                <input
                  className="input mt-1"
                  type="number"
                  step="0.01"
                  value={form.collar_elevation_m}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_elevation_m: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Collar Source
                <select
                  className="select-gradient-sm mt-1"
                  value={form.collar_source}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_source: e.target.value }))}
                >
                  {COLLAR_SOURCE_OPTIONS.map((source) => (
                    <option key={source || "none"} value={source}>
                      {source || "Select..."}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Started At
                <input
                  className="input mt-1"
                  type="datetime-local"
                  value={form.started_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, started_at: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Completed At
                <input
                  className="input mt-1"
                  type="datetime-local"
                  value={form.completed_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, completed_at: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Completion Status
                <select
                  className="select-gradient-sm mt-1"
                  value={form.completion_status}
                  onChange={(e) => setForm((prev) => ({ ...prev, completion_status: e.target.value }))}
                >
                  {COMPLETION_STATUS_OPTIONS.map((status) => (
                    <option key={status || "none"} value={status}>
                      {status || "Select..."}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Completion Notes
                <textarea
                  className="textarea mt-1"
                  rows={3}
                  value={form.completion_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, completion_notes: e.target.value }))}
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
              <button type="button" className="btn btn-primary" onClick={saveHole} disabled={saving || projectScope === "shared"}>
                {saving ? "Saving…" : isCreateMode ? "Add Hole" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-md p-3 md:p-5">
          <div className="glass h-full w-full rounded-2xl border border-white/15 bg-slate-950/85 shadow-[0_30px_90px_rgba(2,6,23,0.65)] overflow-hidden flex flex-col">
            <div className="border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-slate-100 truncate">Bulk Hole Uploader</h3>
                  <p className="text-xs md:text-sm text-slate-400 mt-1">
                    Paste directly from Excel, CSV, or TSV. Validate headers, preview records, then import.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn" onClick={downloadBulkSample}>
                    Download sample
                  </button>
                  <button className="btn" onClick={() => setShowBulk(false)}>Close</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Parsed rows</div>
                  <div className="text-base font-semibold text-slate-100">{parsed.length}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Valid rows</div>
                  <div className="text-base font-semibold text-emerald-300">{bulkValidRowsCount}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Invalid headers</div>
                  <div className="text-base font-semibold text-amber-300">{bulkInvalidHeaders.length}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Required missing</div>
                  <div className="text-base font-semibold text-rose-300">{bulkMissingRequired.length}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.05fr_1.2fr] gap-4 p-4 md:p-6 overflow-hidden">
              <div className="min-h-0 flex flex-col gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Paste CSV/TSV</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={copyBulkHeaders}
                        title={bulkHeaderCsv}
                      >
                        Copy headers
                      </button>
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    rows={12}
                    className="textarea font-mono text-xs"
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
                  <div className="mt-2 text-xs text-slate-400">
                    Tip: paste directly from Excel or Google Sheets. Tab-delimited paste is supported.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-200">Validation</div>
                  {bulkInvalidHeaders.length > 0 && (
                    <div className="text-xs text-amber-300">
                      Unexpected headers: {bulkInvalidHeaders.join(", ")}
                    </div>
                  )}
                  {bulkMissingRequired.length > 0 && (
                    <div className="text-xs text-rose-300">
                      Missing required headers: {bulkMissingRequired.join(", ")}
                    </div>
                  )}
                  {bulkInvalidHeaders.length === 0 && bulkMissingRequired.length === 0 && parsed.length > 0 && (
                    <div className="text-xs text-emerald-300">Headers look good and ready to import.</div>
                  )}
                  {parsed.length === 0 && (
                    <div className="text-xs text-slate-400">Paste records to start validation.</div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 min-h-0 overflow-auto">
                  <div className="text-sm font-medium text-slate-200 mb-2">Column guide</div>
                  <div className="space-y-1">
                    {BULK_COLUMNS.map((column) => (
                      <div key={column.key} className="flex items-start justify-between gap-3 text-xs">
                        <div className="text-slate-200 font-mono">{column.key}</div>
                        <div className="text-slate-400 text-right">{column.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-200">Preview (first 200 rows)</div>
                  <div className="text-xs text-slate-400">Scroll horizontally for all fields</div>
                </div>

                <div className="table-container flex-1 min-h-0 overflow-hidden" style={{ maxHeight: "100%" }}>
                  <div className="h-full w-full overflow-x-auto overflow-y-auto">
                    <table className="table min-w-[2200px]">
                      <thead>
                        <tr>
                          <th className="left-0 z-20" style={{ left: 0, minWidth: 170 }}>hole_id</th>
                          <th className="left-0 z-20" style={{ left: 170, minWidth: 110 }}>depth</th>
                          {BULK_COLUMNS.filter((c) => !["hole_id", "depth"].includes(c.key)).map((column) => (
                            <th key={column.key}>{column.key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(parsed || []).slice(0, 200).map((row, index) => (
                          <tr key={index}>
                            <td className="sticky left-0 z-10 bg-slate-900/95" style={{ left: 0, minWidth: 170 }}>{row.hole_id}</td>
                            <td className="sticky left-0 z-10 bg-slate-900/95" style={{ left: 170, minWidth: 110 }}>{row.depth}</td>
                            {BULK_COLUMNS.filter((c) => !["hole_id", "depth"].includes(c.key)).map((column) => (
                              <td key={column.key}>{row[column.key]}</td>
                            ))}
                          </tr>
                        ))}
                        {parsed.length === 0 && (
                          <tr>
                            <td colSpan={BULK_COLUMNS.length} className="text-center text-sm text-slate-400 py-8">
                              Paste data to preview records.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 px-4 py-3 md:px-6 md:py-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBulkUpload}
                className="btn btn-primary"
                disabled={!bulkCanImport}
              >
                {importing ? "Importing..." : `Import ${bulkValidRowsCount || 0} rows`}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setBulkText("");
                  setParsed([]);
                }}
              >
                Clear all
              </button>
              <div className="ml-auto text-xs text-slate-400">
                Required header: <span className="font-mono text-slate-300">hole_id</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
