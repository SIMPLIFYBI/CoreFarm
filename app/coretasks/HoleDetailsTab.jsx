"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { parseTable } from "@/lib/parseTable";
import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";

const STATE_OPTIONS = ["proposed", "in_progress", "drilled"];
const DIAMETER_OPTIONS = ["", "NQ", "HQ", "PQ", "Other"];
const COLLAR_SOURCE_OPTIONS = ["", "gps", "survey", "estimated", "imported"];
const COMPLETION_STATUS_OPTIONS = ["", "completed", "abandoned", "suspended"];
const BULK_KEEP_VALUE = "__keep__";
const BULK_COLUMNS = [
  { key: "hole_id", required: true, description: "Unique hole identifier." },
  { key: "depth", required: false, description: "Actual drilled depth (m)." },
  { key: "planned_depth", required: false, description: "Planned depth (m)." },
  { key: "water_level_m", required: false, description: "Water level from collar (m)." },
  { key: "azimuth", required: false, description: "0 <= azimuth < 360." },
  { key: "dip", required: false, description: "-90 to +90." },
  { key: "collar_longitude", required: false, description: "WGS84 longitude." },
  { key: "collar_latitude", required: false, description: "WGS84 latitude." },
  { key: "collar_easting", required: false, description: "Projected easting against the project CRS." },
  { key: "collar_northing", required: false, description: "Projected northing against the project CRS." },
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

export default function HoleDetailsTab({ projectScope = "own" }) {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [holes, setHoles] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [diameterFilter, setDiameterFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [parsed, setParsed] = useState([]);

  const [selectedHole, setSelectedHole] = useState(null);
  const [selectedHoleIds, setSelectedHoleIds] = useState([]);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [form, setForm] = useState({
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
    drilling_diameter: "",
    drilling_contractor: "",
    project_id: "",
  });
  const [bulkEditForm, setBulkEditForm] = useState({
    project_id: BULK_KEEP_VALUE,
    state: BULK_KEEP_VALUE,
    drilling_diameter: BULK_KEEP_VALUE,
    drilling_contractor_action: "keep",
    drilling_contractor: "",
  });

  const sampleHeaders = useMemo(
    () =>
      "hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,drilling_diameter,drilling_contractor\n" +
      "HOLE-001,150,200,12.5,135.0,-60.0,121.12345,-27.12345,,,385.2,gps,2026-03-01T06:00,2026-03-02T18:00,completed,Completed to planned depth,NQ,North Drilling\n" +
      "HOLE-002,220,250,18.0,142.5,-55.0,,,500120.4,6987450.2,388.1,survey,2026-03-03T07:30,2026-03-04T16:40,completed,Deviation survey complete,HQ,Westline Drilling\n" +
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
            "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,drilling_diameter,drilling_contractor,project_id,created_at,organization_id,projects(name,coordinate_crs_code,coordinate_crs_name)"
          )
          .in("project_id", sharedProjectIds)
          .neq("organization_id", orgId)
          .order("created_at", { ascending: false });
        if (holesErr) throw holesErr;

        const projectMap = new Map();
        (sharedHoles || []).forEach((h) => {
          if (h.project_id && h.projects?.name) projectMap.set(h.project_id, h.projects.name);
        });

        setHoles(
          (sharedHoles || []).map((hole) => {
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
          })
        );
        setProjects(Array.from(projectMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const [holesRes, projectsRes] = await Promise.all([
          supabase
            .from("holes")
            .select(
              "id,hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,drilling_diameter,drilling_contractor,project_id,created_at,projects(name,coordinate_crs_code,coordinate_crs_name)"
            )
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase.from("projects").select("id,name,coordinate_crs_code,coordinate_crs_name").eq("organization_id", orgId).order("name", { ascending: true }),
        ]);

        if (holesRes.error) throw holesRes.error;
        if (projectsRes.error) throw projectsRes.error;

        setHoles(
          (holesRes.data || []).map((hole) => {
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
          })
        );
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
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncIsMobile = (event) => setIsMobile(event.matches);

    syncIsMobile(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsMobile);
      return () => mediaQuery.removeEventListener("change", syncIsMobile);
    }

    mediaQuery.addListener(syncIsMobile);
    return () => mediaQuery.removeListener(syncIsMobile);
  }, []);

  useEffect(() => {
    setProjectFilter("");
    setSelectedHole(null);
    setSelectedHoleIds([]);
    setIsCreateMode(false);
    setBulkProjectId("");
    setShowBulkEdit(false);
  }, [projectScope]);

  useEffect(() => {
    if (isMobile) {
      setSelectedHoleIds([]);
      setShowBulkEdit(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!showBulk || projectScope === "shared") return;
    setBulkProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) return current;
      return resolveDefaultProjectId(projects, projectFilter);
    });
  }, [showBulk, projectFilter, projectScope, projects]);

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

  useEffect(() => {
    const validIds = new Set((holes || []).map((hole) => hole.id));
    setSelectedHoleIds((current) => current.filter((id) => validIds.has(id)));
  }, [holes]);

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

  const selectedBulkProject = useMemo(
    () => projects.find((project) => project.id === bulkProjectId) || null,
    [projects, bulkProjectId]
  );

  const activeFilterCount = useMemo(
    () => [search.trim(), projectFilter, stateFilter, diameterFilter].filter(Boolean).length,
    [search, projectFilter, stateFilter, diameterFilter]
  );

  const holeHeaderStats = useMemo(
    () => [
      { label: "visible holes", value: loading ? "..." : filteredHoles.length },
      { label: "projects", value: loading ? "..." : projects.length },
      { label: "active filters", value: activeFilterCount },
    ],
    [activeFilterCount, filteredHoles.length, loading, projects.length]
  );

  const filteredHoleIds = useMemo(() => filteredHoles.map((hole) => hole.id), [filteredHoles]);

  const allFilteredSelected = useMemo(
    () => filteredHoleIds.length > 0 && filteredHoleIds.every((id) => selectedHoleIds.includes(id)),
    [filteredHoleIds, selectedHoleIds]
  );

  const bulkCanImport =
    !importing &&
    parsed.length > 0 &&
    bulkInvalidHeaders.length === 0 &&
    bulkMissingRequired.length === 0 &&
    !!bulkProjectId &&
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

  const deleteHoles = async (holeIds) => {
    if (projectScope === "shared") {
      toast.error("Client-shared holes are read-only here");
      return;
    }
    if (!holeIds.length) return;

    const message =
      holeIds.length === 1
        ? "Are you sure you want to delete this hole? This action cannot be undone."
        : `Are you sure you want to delete these ${holeIds.length} holes? This action cannot be undone.`;

    if (typeof window !== "undefined" && !window.confirm(message)) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("holes").delete().in("id", holeIds).eq("organization_id", orgId);
      if (error) throw error;

      toast.success(holeIds.length === 1 ? "Hole deleted" : `${holeIds.length} holes deleted`);
      setSelectedHoleIds((current) => current.filter((id) => !holeIds.includes(id)));
      if (selectedHole?.id && holeIds.includes(selectedHole.id)) {
        setSelectedHole(null);
        setIsCreateMode(false);
      }
      await loadData();
    } catch (error) {
      toast.error(error?.message || "Failed to delete holes");
    } finally {
      setDeleting(false);
    }
  };

  const applyBulkEdit = async () => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    if (!selectedHoleIds.length) return toast.error("Select at least one hole to edit");

    const payload = {};

    if (bulkEditForm.project_id !== BULK_KEEP_VALUE) {
      const selectedProject = projects.find((project) => project.id === bulkEditForm.project_id) || null;
      if (!selectedProject) return toast.error("Select a valid project for bulk edit");
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

    if (Object.keys(payload).length === 0) {
      toast.error("Choose at least one change to apply");
      return;
    }

    setBulkUpdating(true);
    try {
      const { error } = await supabase.from("holes").update(payload).in("id", selectedHoleIds).eq("organization_id", orgId);
      if (error) throw error;

      toast.success(`Updated ${selectedHoleIds.length} holes`);
      closeBulkEdit(true);
      await loadData();
    } catch (error) {
      toast.error(error?.message || "Failed to update selected holes");
    } finally {
      setBulkUpdating(false);
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
      collar_easting: hole.collar_easting ?? "",
      collar_northing: hole.collar_northing ?? "",
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
    if (saving || deleting) return;
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
      collar_easting: "",
      collar_northing: "",
      collar_elevation_m: "",
      collar_source: "",
      started_at: "",
      completed_at: "",
      completion_status: "",
      completion_notes: "",
      state: "proposed",
      drilling_diameter: "",
      drilling_contractor: "",
      project_id: resolveDefaultProjectId(projects, projectFilter),
    });
  };

  const saveHole = async () => {
    if (projectScope === "shared") return toast.error("Client-shared holes are read-only here");
    if (!selectedHole) return;
    if (!String(form.hole_id || "").trim()) {
      toast.error("Hole ID is required");
      return;
    }
    if (!form.project_id) {
      toast.error("Project is required");
      return;
    }

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
      const selectedProject = projects.find((project) => project.id === (form.project_id || "")) || null;
      if (!selectedProject) return toast.error("Selected project could not be found");
      const projectedCoordinates = deriveHoleCoordinates({
        collarLongitude: null,
        collarLatitude: null,
        collarEasting,
        collarNorthing,
        projectCrsCode: selectedProject?.coordinate_crs_code || null,
      });
      const effectiveLongitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLongitude : collarLongitude;
      const effectiveLatitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLatitude : collarLatitude;

      if (form.azimuth !== "" && azimuth == null) return toast.error("Azimuth must be a number");
      if (form.dip !== "" && dip == null) return toast.error("Dip must be a number");
      if (azimuth != null && (azimuth < 0 || azimuth >= 360)) return toast.error("Azimuth must be between 0 and < 360");
      if (dip != null && (dip < -90 || dip > 90)) return toast.error("Dip must be between -90 and 90");
      if ((collarEasting == null) !== (collarNorthing == null)) return toast.error("Easting and northing must both be set or both blank");
      if ((collarEasting != null || collarNorthing != null) && !form.project_id) return toast.error("Select a project before entering easting and northing");
      if ((collarEasting != null || collarNorthing != null) && !selectedProject?.coordinate_crs_code) return toast.error("Set a project coordinate system before saving projected coordinates");
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
        drilling_diameter: form.drilling_diameter || null,
        drilling_contractor: toTextOrNull(form.drilling_contractor),
        project_id: form.project_id,
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
    if (!bulkProjectId) return toast.error("Select the project these holes belong to");
    if (!selectedBulkProject) return toast.error("Selected project could not be found");

    const rows = parsed.length ? parsed : parseTable(bulkText);
    if (!rows.length) return toast.error("No rows found");

    const invalid = Object.keys(rows[0] || {}).filter((key) => !bulkAllowedHeaders.includes(key));
    if (invalid.length) return toast.error(`Unexpected headers: ${invalid.join(", ")}`);

    const missing = bulkRequiredHeaders.filter((key) => !(key in (rows[0] || {})));
    if (missing.length) return toast.error(`Missing required headers: ${missing.join(", ")}`);

    const payloads = [];

    for (const [index, row] of rows.entries()) {
      const holeId = String(row.hole_id || "").trim();
      if (!holeId) continue;

      const rowLabel = `Row ${index + 2}`;
      const azimuth = toNumOrNull(row.azimuth);
      const dip = toNumOrNull(row.dip);
      const collarEasting = toNumOrNull(row.collar_easting);
      const collarNorthing = toNumOrNull(row.collar_northing);
      const collarLongitude = toNumOrNull(row.collar_longitude);
      const collarLatitude = toNumOrNull(row.collar_latitude);
      const startedAt = toIsoOrNull(row.started_at);
      const completedAt = toIsoOrNull(row.completed_at);
      const projectedCoordinates = deriveHoleCoordinates({
        collarLongitude: null,
        collarLatitude: null,
        collarEasting,
        collarNorthing,
        projectCrsCode: selectedBulkProject.coordinate_crs_code || null,
      });
      const effectiveLongitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLongitude : collarLongitude;
      const effectiveLatitude = collarEasting != null && collarNorthing != null ? projectedCoordinates.collarLatitude : collarLatitude;

      if (String(row.azimuth || "").trim() && azimuth == null) return toast.error(`${rowLabel}: azimuth must be a number`);
      if (String(row.dip || "").trim() && dip == null) return toast.error(`${rowLabel}: dip must be a number`);
      if (azimuth != null && (azimuth < 0 || azimuth >= 360)) return toast.error(`${rowLabel}: azimuth must be between 0 and < 360`);
      if (dip != null && (dip < -90 || dip > 90)) return toast.error(`${rowLabel}: dip must be between -90 and 90`);
      if ((collarEasting == null) !== (collarNorthing == null)) return toast.error(`${rowLabel}: easting and northing must both be set or both blank`);
      if ((collarEasting != null || collarNorthing != null) && !selectedBulkProject.coordinate_crs_code) {
        return toast.error(`${rowLabel}: the selected project needs a coordinate system before importing projected coordinates`);
      }
      if ((collarLongitude == null) !== (collarLatitude == null)) return toast.error(`${rowLabel}: longitude and latitude must both be set or both blank`);
      if (String(row.started_at || "").trim() && !startedAt) return toast.error(`${rowLabel}: started_at is invalid`);
      if (String(row.completed_at || "").trim() && !completedAt) return toast.error(`${rowLabel}: completed_at is invalid`);

      payloads.push({
        hole_id: holeId,
        depth: toNumOrNull(row.depth),
        planned_depth: toNumOrNull(row.planned_depth),
        water_level_m: toNumOrNull(row.water_level_m),
        azimuth,
        dip,
        collar_longitude: effectiveLongitude,
        collar_latitude: effectiveLatitude,
        collar_easting: collarEasting,
        collar_northing: collarNorthing,
        collar_elevation_m: toNumOrNull(row.collar_elevation_m),
        collar_source: toTextOrNull(row.collar_source),
        started_at: startedAt,
        completed_at: completedAt,
        completion_status: toTextOrNull(row.completion_status),
        completion_notes: toTextOrNull(row.completion_notes),
        drilling_diameter: row.drilling_diameter || null,
        drilling_contractor: toTextOrNull(row.drilling_contractor),
        project_id: bulkProjectId,
        state: "proposed",
        organization_id: orgId || null,
      });
    }

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
      <CoreTaskPanelHeader
        eyebrow="Hole Details"
        title="Manage the hole register, imports, and drill program details in one place."
        description="Search and filter the register, jump into edits quickly, and keep every hole linked to the right project before it moves downstream into logging and visualization."
        stats={holeHeaderStats}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="btn btn-3d-glass hidden md:inline-flex"
              disabled={projectScope === "shared"}
              onClick={() => {
                setShowBulk(true);
                setBulkProjectId(resolveDefaultProjectId(projects, projectFilter));
                setParsed([]);
              }}
            >
              Open bulk uploader
            </button>
            <button type="button" className="btn btn-3d-primary" onClick={openCreateHole} disabled={projectScope === "shared"}>
              Add New Core
            </button>
          </div>
        }
      />

      {projectScope !== "shared" && !isMobile && selectedHoleIds.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-base font-medium text-slate-100">Selected Holes</h3>
              <p className="text-sm text-slate-300 mt-1">
                {selectedHoleIds.length} hole{selectedHoleIds.length === 1 ? "" : "s"} selected for bulk actions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button type="button" className="btn btn-3d-primary" onClick={openBulkEditModal} disabled={bulkUpdating || deleting}>
                Edit selected
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void deleteHoles(selectedHoleIds)}
                disabled={bulkUpdating || deleting}
              >
                {deleting ? "Deleting..." : "Delete selected"}
              </button>
              <button type="button" className="btn btn-3d-glass" onClick={() => setSelectedHoleIds([])} disabled={bulkUpdating || deleting}>
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden">
        <button
          type="button"
          className={[
            "btn w-full justify-between px-4",
            showMobileFilters || activeFilterCount > 0 ? "btn-3d-glass" : "",
          ].join(" ")}
          onClick={() => setShowMobileFilters((current) => !current)}
        >
          <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
          <span className="text-xs text-slate-300">{showMobileFilters ? "Hide" : "Show"}</span>
        </button>
      </div>

      <div className={["card p-4 md:p-5 space-y-4", showMobileFilters ? "block" : "hidden md:block"].join(" ")}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-sm text-slate-200">
            Search Holes
            <input
              className="input h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hole ID, project, contractor..."
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-slate-200">
              Project
              <select className="select-gradient-sm h-10 min-w-[170px]" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
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
              <select className="select-gradient-sm h-10 min-w-[150px]" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="">All states</option>
                {STATE_OPTIONS.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-slate-200">
              Diameter
              <select className="select-gradient-sm h-10 min-w-[150px]" value={diameterFilter} onChange={(e) => setDiameterFilter(e.target.value)}>
                <option value="">All diameters</option>
                {DIAMETER_OPTIONS.filter(Boolean).map((diameter) => (
                  <option key={diameter} value={diameter}>
                    {diameter}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn-3d-glass h-10 px-5"
              onClick={() => {
                setSearch("");
                setProjectFilter("");
                setStateFilter("");
                setDiameterFilter("");
                setShowMobileFilters(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Tip: use the filters to narrow the table, then select visible rows for bulk edit or delete.
        </div>
      </div>

      <div className="table-container">
        <div className="mb-2 px-1 text-xs text-slate-400">
          Showing {filteredHoles.length} of {holes.length} hole{holes.length === 1 ? "" : "s"}
        </div>
        <table className="table">
          <thead>
            <tr>
              {projectScope !== "shared" && !isMobile && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible holes"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                  />
                </th>
              )}
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
                <td colSpan={projectScope === "shared" || isMobile ? 8 : 9} className="text-center py-8 text-slate-300">
                  Loading holes…
                </td>
              </tr>
            ) : filteredHoles.length === 0 ? (
              <tr>
                <td colSpan={projectScope === "shared" || isMobile ? 8 : 9} className="text-center py-8 text-slate-300">
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
                  {projectScope !== "shared" && !isMobile && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${hole.hole_id}`}
                        checked={selectedHoleIds.includes(hole.id)}
                        onChange={() => toggleHoleSelection(hole.id)}
                      />
                    </td>
                  )}
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
              <button type="button" className="btn btn-3d-glass" onClick={closeHole} disabled={saving}>
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
                Collar Easting
                <input
                  className="input mt-1"
                  type="number"
                  step="0.001"
                  value={form.collar_easting}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_easting: e.target.value }))}
                />
              </label>

              <label className="text-sm">
                Collar Northing
                <input
                  className="input mt-1"
                  type="number"
                  step="0.001"
                  value={form.collar_northing}
                  onChange={(e) => setForm((prev) => ({ ...prev, collar_northing: e.target.value }))}
                />
              </label>

              {form.project_id ? (
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300 md:col-span-2">
                  {(() => {
                    const selectedProject = projects.find((project) => project.id === form.project_id) || null;
                    return `Working CRS: ${formatProjectCrs(selectedProject)}`;
                  })()}
                </div>
              ) : null}

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
                Project *
                <select
                  className="select-gradient-sm mt-1"
                  value={form.project_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, project_id: e.target.value }))}
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {!isCreateMode && projectScope !== "shared" && (
                <button
                  type="button"
                  className="btn btn-danger mr-auto"
                  onClick={() => void deleteHoles([selectedHole.id])}
                  disabled={saving || deleting}
                >
                  {deleting ? "Deleting..." : "Delete Hole"}
                </button>
              )}
              <button type="button" className="btn btn-3d-glass" onClick={closeHole} disabled={saving || deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-3d-primary" onClick={saveHole} disabled={saving || projectScope === "shared"}>
                {saving ? "Saving…" : isCreateMode ? "Add Hole" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-xl p-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Edit Selected Holes</h3>
                <p className="text-sm text-slate-400 mt-1">Apply updates to {selectedHoleIds.length} selected hole{selectedHoleIds.length === 1 ? "" : "s"}.</p>
              </div>
              <button type="button" className="btn btn-3d-glass" onClick={() => closeBulkEdit()} disabled={bulkUpdating}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                Project
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.project_id}
                  onChange={(e) => setBulkEditForm((prev) => ({ ...prev, project_id: e.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep current</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                State
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.state}
                  onChange={(e) => setBulkEditForm((prev) => ({ ...prev, state: e.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep current</option>
                  {STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Diameter
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.drilling_diameter}
                  onChange={(e) => setBulkEditForm((prev) => ({ ...prev, drilling_diameter: e.target.value }))}
                >
                  <option value={BULK_KEEP_VALUE}>Keep current</option>
                  {DIAMETER_OPTIONS.map((diameter) => (
                    <option key={diameter || "clear"} value={diameter}>
                      {diameter || "Clear diameter"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Drilling Contractor
                <select
                  className="select-gradient-sm mt-1"
                  value={bulkEditForm.drilling_contractor_action}
                  onChange={(e) => setBulkEditForm((prev) => ({ ...prev, drilling_contractor_action: e.target.value }))}
                >
                  <option value="keep">Keep current</option>
                  <option value="set">Set contractor</option>
                  <option value="clear">Clear contractor</option>
                </select>
              </label>

              {bulkEditForm.drilling_contractor_action === "set" && (
                <label className="text-sm md:col-span-2">
                  Contractor Name
                  <input
                    className="input mt-1"
                    value={bulkEditForm.drilling_contractor}
                    onChange={(e) => setBulkEditForm((prev) => ({ ...prev, drilling_contractor: e.target.value }))}
                    placeholder="Enter contractor name"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-3d-glass" onClick={() => closeBulkEdit()} disabled={bulkUpdating}>
                Cancel
              </button>
              <button type="button" className="btn btn-3d-primary" onClick={applyBulkEdit} disabled={bulkUpdating}>
                {bulkUpdating ? "Applying..." : `Apply to ${selectedHoleIds.length} hole${selectedHoleIds.length === 1 ? "" : "s"}`}
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
                  <button type="button" className="btn btn-3d-glass" onClick={downloadBulkSample}>
                    Download sample
                  </button>
                  <button className="btn btn-3d-glass" onClick={() => setShowBulk(false)}>Close</button>
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
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                  <label className="block text-sm font-medium text-slate-200">
                    Upload Into Project
                    <select
                      className="select-gradient-sm mt-2 w-full"
                      value={bulkProjectId}
                      onChange={(e) => setBulkProjectId(e.target.value)}
                    >
                      <option value="">Select a project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs text-slate-400">
                    Every imported hole will be assigned to this project.
                  </div>
                  {selectedBulkProject ? (
                    <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                      Working CRS: {formatProjectCrs(selectedBulkProject)}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-300/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                      Select a project before importing holes.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-200">Paste CSV/TSV</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-3d-glass btn-xs"
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
                  {!bulkProjectId && (
                    <div className="text-xs text-rose-300">Choose a project to enable import.</div>
                  )}
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
                className="btn btn-3d-primary"
                disabled={!bulkCanImport}
              >
                {importing ? "Importing..." : `Import ${bulkValidRowsCount || 0} rows`}
              </button>
              <button
                type="button"
                className="btn btn-3d-glass"
                onClick={() => {
                  setBulkText("");
                  setParsed([]);
                }}
              >
                Clear all
              </button>
              <div className="ml-auto text-xs text-slate-400">
                Required: <span className="font-mono text-slate-300">hole_id</span> header and project selection
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
