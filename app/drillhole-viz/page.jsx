"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";
import TabButton from "./components/TabButton";
import GeologyIntervalsTab from "./components/GeologyIntervalsTab";
import ConstructionIntervalsTab from "./components/ConstructionIntervalsTab";
import AnnulusIntervalsTab from "./components/AnnulusIntervalsTab";
import ComponentsTab from "./components/ComponentsTab";
import HoleTab from "./components/HoleTab";
import AttributesTab from "./components/AttributesTab";
import SchematicArea from "./components/SchematicArea";
import TypesTabs from "./components/TypesTabs";
import { exportSchematicPdf } from "./utils/exportSchematicPdf";
import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";

const PROJECT_SCOPE_STORAGE_KEY = "coretasks:projectScope";

export default function DrillholeVizPage({ projectScope: externalProjectScope }) {
  const supabase = supabaseBrowser();
  const { orgId: selectedOrgId, memberships } = useOrg();
  const [localProjectScope, setLocalProjectScope] = useState("own");
  const projectScope = externalProjectScope ?? localProjectScope;

  const myRole = useMemo(() => {
    const m = (memberships || []).find((m) => m.organization_id === selectedOrgId);
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

  // NEW
  const [waterLevelInput, setWaterLevelInput] = useState("");
  const [savingWaterLevel, setSavingWaterLevel] = useState(false);
  const [savingAdditionalAttributes, setSavingAdditionalAttributes] = useState(false);
  const [attributeTouched, setAttributeTouched] = useState({});
  const [attributeInputs, setAttributeInputs] = useState({
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
  });

  // Types (existing)
  const [lithologyTypesAll, setLithologyTypesAll] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesSaving, setTypesSaving] = useState(false);

  // Geology editor state
  const [geoRows, setGeoRows] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoSaving, setGeoSaving] = useState(false);

  // Construction types (org-level)
  const [constructionTypesAll, setConstructionTypesAll] = useState([]);
  const [constructionTypesLoading, setConstructionTypesLoading] = useState(false);
  const [constructionTypesSaving, setConstructionTypesSaving] = useState(false);

  // Construction intervals (hole-level)
  const [constructionRows, setConstructionRows] = useState([]);
  const [constructionLoading, setConstructionLoading] = useState(false);
  const [constructionSaving, setConstructionSaving] = useState(false);

  // --- NEW: Annulus types (org-level)
  const [annulusTypesAll, setAnnulusTypesAll] = useState([]);
  const [annulusTypesLoading, setAnnulusTypesLoading] = useState(false);
  const [annulusTypesSaving, setAnnulusTypesSaving] = useState(false);

  // Component types (org-level)
  const [componentTypesAll, setComponentTypesAll] = useState([]);
  const [componentTypesLoading, setComponentTypesLoading] = useState(false);
  const [componentTypesSaving, setComponentTypesSaving] = useState(false);

  // --- NEW: Annulus intervals (hole-level)
  const [annulusRows, setAnnulusRows] = useState([]);
  const [annulusLoading, setAnnulusLoading] = useState(false);
  const [annulusSaving, setAnnulusSaving] = useState(false);

  // Components (hole-level)
  const [componentRows, setComponentRows] = useState([]);
  const [componentLoading, setComponentLoading] = useState(false);
  const [componentSaving, setComponentSaving] = useState(false);

  const isSharedScope = projectScope === "shared";
  // Shared drillholes are view-only in this screen.
  const canEdit = !isSharedScope && (myRole === "admin" || myRole === "member");

  const selectedHole = useMemo(() => {
    return (holes || []).find((h) => h.id === selectedHoleId) || null;
  }, [holes, selectedHoleId]);

  const selectedHoleOrgId = selectedHole?.organization_id || selectedOrgId;

  const toDateTimeLocal = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (externalProjectScope) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PROJECT_SCOPE_STORAGE_KEY);
    if (stored === "own" || stored === "shared") {
      setLocalProjectScope(stored);
    }
  }, [externalProjectScope]);

  useEffect(() => {
    if (externalProjectScope) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, localProjectScope);
  }, [externalProjectScope, localProjectScope]);

  // Keep the planned depth editor in sync with the selected hole
  useEffect(() => {
    if (!selectedHole) {
      setPlannedDepthInput("");
      setWaterLevelInput("");
      setAttributeTouched({});
      setAttributeInputs({
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
      });
      return;
    }

    setPlannedDepthInput(selectedHole.planned_depth ?? "");
    setWaterLevelInput(selectedHole.water_level_m ?? "");
  setAttributeTouched({});
    setAttributeInputs({
      azimuth: selectedHole.azimuth ?? "",
      dip: selectedHole.dip ?? "",
      collar_longitude: selectedHole.collar_longitude ?? "",
      collar_latitude: selectedHole.collar_latitude ?? "",
      collar_easting: selectedHole.collar_easting ?? "",
      collar_northing: selectedHole.collar_northing ?? "",
      collar_elevation_m: selectedHole.collar_elevation_m ?? "",
      collar_source: selectedHole.collar_source ?? "",
      started_at: toDateTimeLocal(selectedHole.started_at),
      completed_at: toDateTimeLocal(selectedHole.completed_at),
      completion_status: selectedHole.completion_status ?? "",
      completion_notes: selectedHole.completion_notes ?? "",
    });
  }, [selectedHole?.id, selectedHole?.planned_depth, selectedHole?.water_level_m, selectedHole?.azimuth, selectedHole?.dip, selectedHole?.collar_longitude, selectedHole?.collar_latitude, selectedHole?.collar_easting, selectedHole?.collar_northing, selectedHole?.collar_elevation_m, selectedHole?.collar_source, selectedHole?.started_at, selectedHole?.completed_at, selectedHole?.completion_status, selectedHole?.completion_notes]);

  // Group holes by project
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

    const arr = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    arr.forEach((p) => p.holes.sort((a, b) => String(a.hole_id || "").localeCompare(String(b.hole_id || ""))));
    return arr;
  }, [holes]);

  const lithById = useMemo(() => {
    const m = new Map();
    for (const t of lithologyTypesAll || []) m.set(t.id, t);
    return m;
  }, [lithologyTypesAll]);

  const lithologyTypesActive = useMemo(() => {
    return (lithologyTypesAll || []).filter((t) => t.is_active !== false);
  }, [lithologyTypesAll]);

  // NEW: Construction type maps
  const constructionById = useMemo(() => {
    const m = new Map();
    for (const t of constructionTypesAll || []) m.set(t.id, t);
    return m;
  }, [constructionTypesAll]);

  const constructionTypesActive = useMemo(() => {
    return (constructionTypesAll || []).filter((t) => t.is_active !== false);
  }, [constructionTypesAll]);

  // NEW: Annulus type maps
  const annulusById = useMemo(() => {
    const m = new Map();
    for (const t of annulusTypesAll || []) m.set(t.id, t);
    return m;
  }, [annulusTypesAll]);

  const annulusTypesActive = useMemo(() => {
    return (annulusTypesAll || []).filter((t) => t.is_active !== false);
  }, [annulusTypesAll]);

  const componentById = useMemo(() => {
    const m = new Map();
    for (const t of componentTypesAll || []) m.set(t.id, t);
    return m;
  }, [componentTypesAll]);

  const componentTypesActive = useMemo(() => {
    return (componentTypesAll || []).filter((t) => t.is_active !== false);
  }, [componentTypesAll]);

  const roundToTenth = (v) => {
    if (v === "" || v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return Math.round(n * 10) / 10;
  };

  // NEW: default "From" value for the next interval in a category
  const nextIntervalFromM = (rows) => {
    const tos = (rows || [])
      .map((r) => Number(r?.to_m))
      .filter((n) => Number.isFinite(n) && n >= 0);

    if (!tos.length) return 0;

    // Continue from the deepest completed "to_m"
    return Math.max(...tos);
  };

  // Existing (geology)
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
      if (cur.from_m < prev.to_m) {
        return {
          ok: false,
          message: `Intervals overlap: ${prev.from_m}-${prev.to_m} overlaps ${cur.from_m}-${cur.to_m}.`,
        };
      }
    }

    return { ok: true, rows: sorted };
  };

  // NEW (construction)
  const validateAndNormalizeConstructionIntervals = (rows) => {
    const cleaned = (rows || [])
      .map((r) => {
        const from = roundToTenth(r.from_m);
        const to = roundToTenth(r.to_m);
        return {
          ...r,
          from_m: from,
          to_m: to,
          construction_type_id: r.construction_type_id || "",
          notes: r.notes || "",
        };
      })
      .filter((r) => r.from_m !== "" || r.to_m !== "" || r.construction_type_id || r.notes);

    for (const r of cleaned) {
      if (r.from_m === "" || r.to_m === "") return { ok: false, message: "All construction intervals need From and To." };
      if (!r.construction_type_id) return { ok: false, message: "All construction intervals need a construction type." };
      if (r.from_m < 0 || r.to_m < 0) return { ok: false, message: "Depths must be ≥ 0." };
      if (!(r.from_m < r.to_m)) return { ok: false, message: "Each interval must have From < To." };
    }

    const sorted = [...cleaned].sort((a, b) => a.from_m - b.from_m);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.from_m < prev.to_m) {
        return {
          ok: false,
          message: `Construction intervals overlap: ${prev.from_m}-${prev.to_m} overlaps ${cur.from_m}-${cur.to_m}.`,
        };
      }
    }

    return { ok: true, rows: sorted };
  };

  // NEW (annulus)
  const validateAndNormalizeAnnulusIntervals = (rows) => {
    const cleaned = (rows || [])
      .map((r) => {
        const from = roundToTenth(r.from_m);
        const to = roundToTenth(r.to_m);
        return {
          ...r,
          from_m: from,
          to_m: to,
          annulus_type_id: r.annulus_type_id || "",
          notes: r.notes || "",
        };
      })
      .filter((r) => r.from_m !== "" || r.to_m !== "" || r.annulus_type_id || r.notes);

    for (const r of cleaned) {
      if (r.from_m === "" || r.to_m === "") return { ok: false, message: "All annulus intervals need From and To." };
      if (!r.annulus_type_id) return { ok: false, message: "All annulus intervals need an annulus type." };
      if (r.from_m < 0 || r.to_m < 0) return { ok: false, message: "Depths must be ≥ 0." };
      if (!(r.from_m < r.to_m)) return { ok: false, message: "Each interval must have From < To." };
    }

    const sorted = [...cleaned].sort((a, b) => a.from_m - b.from_m);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.from_m < prev.to_m) {
        return {
          ok: false,
          message: `Annulus intervals overlap: ${prev.from_m}-${prev.to_m} overlaps ${cur.from_m}-${cur.to_m}.`,
        };
      }
    }

    return { ok: true, rows: sorted };
  };

  const reloadLithologyTypes = async (organizationId = selectedHoleOrgId) => {
    if (!organizationId) {
      setLithologyTypesAll([]);
      return;
    }
    setTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_lithology_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", organizationId)
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

  const reloadConstructionTypes = async (organizationId = selectedHoleOrgId) => {
    if (!organizationId) {
      setConstructionTypesAll([]);
      return;
    }
    setConstructionTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_construction_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    setConstructionTypesLoading(false);

    if (error) {
      console.error(error);
      toast.error("Could not load construction types");
      setConstructionTypesAll([]);
      return;
    }

    setConstructionTypesAll(
      (data || []).map((t) => ({
        id: t.id,
        name: t.name || "",
        color: t.color || "#64748b",
        sort_order: t.sort_order ?? 0,
        is_active: t.is_active !== false,
      }))
    );
  };

  // --- NEW: load annulus types
  const reloadAnnulusTypes = async (organizationId = selectedHoleOrgId) => {
    if (!organizationId) {
      setAnnulusTypesAll([]);
      return;
    }
    setAnnulusTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_annulus_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    setAnnulusTypesLoading(false);

    if (error) {
      console.error(error);
      toast.error("Could not load annulus types");
      setAnnulusTypesAll([]);
      return;
    }

    setAnnulusTypesAll(
      (data || []).map((t) => ({
        id: t.id,
        name: t.name || "",
        color: t.color || "#64748b",
        sort_order: t.sort_order ?? 0,
        is_active: t.is_active !== false,
      }))
    );
  };

  const reloadComponentTypes = async (organizationId = selectedHoleOrgId) => {
    if (!organizationId) {
      setComponentTypesAll([]);
      return;
    }
    setComponentTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_component_types")
      .select("id, key, name, category, icon, color, sort_order, is_active, details_schema, created_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    setComponentTypesLoading(false);

    if (error) {
      console.error(error);
      toast.error("Could not load component types");
      setComponentTypesAll([]);
      return;
    }

    setComponentTypesAll(
      (data || []).map((t) => ({
        id: t.id,
        key: t.key || "",
        name: t.name || "",
        category: t.category || "sensor",
        icon: t.icon || "dot",
        color: t.color || "#64748b",
        sort_order: t.sort_order ?? 0,
        is_active: t.is_active !== false,
        details_schema: t.details_schema || {},
        details_schema_json: JSON.stringify(t.details_schema || { fields: [] }, null, 2),
      }))
    );
  };

  useEffect(() => {
    reloadLithologyTypes(selectedHoleOrgId);
    reloadConstructionTypes(selectedHoleOrgId);
    reloadAnnulusTypes(selectedHoleOrgId);
    reloadComponentTypes(selectedHoleOrgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHoleOrgId]);

  // Lithology types CRUD (existing)
  const addLithologyTypeRow = () => {
    setLithologyTypesAll((prev) => [
      ...(prev || []),
      { id: null, name: "", color: "#64748b", sort_order: (prev?.length || 0) + 1, is_active: true },
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

      for (const t of cleaned.filter((x) => !!x.id)) {
        const { error } = await supabase
          .from("drillhole_lithology_types")
          .update({ name: t.name, color: t.color, sort_order: t.sort_order, is_active: t.is_active })
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

  // Construction types CRUD (existing)
  const addConstructionTypeRow = () => {
    setConstructionTypesAll((prev) => [
      ...(prev || []),
      { id: null, name: "", color: "#64748b", sort_order: (prev?.length || 0) + 1, is_active: true },
    ]);
  };

  const updateConstructionTypeRow = (idx, patch) => {
    setConstructionTypesAll((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const deleteConstructionType = async (idx) => {
    const row = constructionTypesAll?.[idx];
    if (!row) return;

    if (!row.id) {
      setConstructionTypesAll((prev) => {
        const next = [...(prev || [])];
        next.splice(idx, 1);
        return next;
      });
      return;
    }

    if (!confirm(`Delete construction type "${row.name || "Unnamed"}"?`)) return;

    const { error } = await supabase.from("drillhole_construction_types").delete().eq("id", row.id);
    if (error) {
      console.error(error);
      toast.error(error.message || "Could not delete construction type");
      return;
    }

    toast.success("Construction type deleted");
    await reloadConstructionTypes();
  };

  const saveConstructionTypes = async () => {
    if (!selectedOrgId) return;

    const cleaned = (constructionTypesAll || []).map((t) => ({
      ...t,
      name: String(t.name || "").trim(),
      color: t.color || "#64748b",
      sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : 0,
      is_active: t.is_active !== false,
    }));

    if (cleaned.some((t) => !t.name)) {
      toast.error("All construction types need a name (or delete the blank row).");
      return;
    }

    try {
      setConstructionTypesSaving(true);

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
        const { error } = await supabase.from("drillhole_construction_types").insert(inserts);
        if (error) throw error;
      }

      for (const t of cleaned.filter((x) => !!x.id)) {
        const { error } = await supabase
          .from("drillhole_construction_types")
          .update({ name: t.name, color: t.color, sort_order: t.sort_order, is_active: t.is_active })
          .eq("id", t.id);
        if (error) throw error;
      }

      toast.success("Construction types saved");
      await reloadConstructionTypes();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save construction types");
    } finally {
      setConstructionTypesSaving(false);
    }
  };

  // --- NEW: Annulus types CRUD
  const addAnnulusTypeRow = () => {
    setAnnulusTypesAll((prev) => [
      ...(prev || []),
      { id: null, name: "", color: "#64748b", sort_order: (prev?.length || 0) + 1, is_active: true },
    ]);
  };

  const updateAnnulusTypeRow = (idx, patch) => {
    setAnnulusTypesAll((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const deleteAnnulusType = async (idx) => {
    const row = annulusTypesAll?.[idx];
    if (!row) return;

    if (!row.id) {
      setAnnulusTypesAll((prev) => {
        const next = [...(prev || [])];
        next.splice(idx, 1);
        return next;
      });
      return;
    }

    if (!confirm(`Delete annulus type "${row.name || "Unnamed"}"?`)) return;

    const { error } = await supabase.from("drillhole_annulus_types").delete().eq("id", row.id);
    if (error) {
      console.error(error);
      toast.error(error.message || "Could not delete annulus type");
      return;
    }

    toast.success("Annulus type deleted");
    await reloadAnnulusTypes();
  };

  const saveAnnulusTypes = async () => {
    if (!selectedOrgId) return;

    const cleaned = (annulusTypesAll || []).map((t) => ({
      ...t,
      name: String(t.name || "").trim(),
      color: t.color || "#64748b",
      sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : 0,
      is_active: t.is_active !== false,
    }));

    if (cleaned.some((t) => !t.name)) {
      toast.error("All annulus types need a name (or delete the blank row).");
      return;
    }

    try {
      setAnnulusTypesSaving(true);

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
        const { error } = await supabase.from("drillhole_annulus_types").insert(inserts);
        if (error) throw error;
      }

      for (const t of cleaned.filter((x) => !!x.id)) {
        const { error } = await supabase
          .from("drillhole_annulus_types")
          .update({ name: t.name, color: t.color, sort_order: t.sort_order, is_active: t.is_active })
          .eq("id", t.id);
        if (error) throw error;
      }

      toast.success("Annulus types saved");
      await reloadAnnulusTypes();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save annulus types");
    } finally {
      setAnnulusTypesSaving(false);
    }
  };

  const slugifyKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const parseDetailsSchemaInput = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return { ok: true, schema: {} };

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, message: "Details schema must be a JSON object." };
      }
      if (parsed.fields != null && !Array.isArray(parsed.fields)) {
        return { ok: false, message: "Details schema fields must be an array." };
      }
      return { ok: true, schema: parsed };
    } catch {
      return { ok: false, message: "Component type details schema must be valid JSON." };
    }
  };

  const addComponentTypeRow = () => {
    setComponentTypesAll((prev) => [
      ...(prev || []),
      {
        id: null,
        key: "",
        name: "",
        category: "sensor",
        icon: "dot",
        color: "#38bdf8",
        sort_order: (prev?.length || 0) + 1,
        is_active: true,
        details_schema: { fields: [] },
        details_schema_json: JSON.stringify({ fields: [] }, null, 2),
      },
    ]);
  };

  const updateComponentTypeRow = (idx, patch) => {
    setComponentTypesAll((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const deleteComponentType = async (idx) => {
    const row = componentTypesAll?.[idx];
    if (!row) return;

    if (!row.id) {
      setComponentTypesAll((prev) => {
        const next = [...(prev || [])];
        next.splice(idx, 1);
        return next;
      });
      return;
    }

    if (!confirm(`Delete component type "${row.name || "Unnamed"}"?`)) return;

    const { error } = await supabase.from("drillhole_component_types").delete().eq("id", row.id);
    if (error) {
      console.error(error);
      toast.error(error.message || "Could not delete component type");
      return;
    }

    toast.success("Component type deleted");
    await reloadComponentTypes();
  };

  const saveComponentTypes = async () => {
    if (!selectedOrgId) return;

    const cleaned = [];
    for (const t of componentTypesAll || []) {
      const schemaResult = parseDetailsSchemaInput(t.details_schema_json);
      if (!schemaResult.ok) {
        toast.error(schemaResult.message);
        return;
      }

      cleaned.push({
        ...t,
        key: slugifyKey(t.key || t.name),
        name: String(t.name || "").trim(),
        category: String(t.category || "sensor").trim() || "sensor",
        icon: String(t.icon || "dot").trim() || "dot",
        color: t.color || "#38bdf8",
        sort_order: Number.isFinite(Number(t.sort_order)) ? Number(t.sort_order) : 0,
        is_active: t.is_active !== false,
        details_schema: schemaResult.schema,
      });
    }

    if (cleaned.some((t) => !t.name || !t.key)) {
      toast.error("All component types need a name and key.");
      return;
    }

    try {
      setComponentTypesSaving(true);

      const inserts = cleaned
        .filter((t) => !t.id)
        .map((t) => ({
          organization_id: selectedOrgId,
          key: t.key,
          name: t.name,
          category: t.category,
          icon: t.icon,
          color: t.color,
          sort_order: t.sort_order,
          is_active: t.is_active,
          details_schema: t.details_schema,
        }));

      if (inserts.length) {
        const { error } = await supabase.from("drillhole_component_types").insert(inserts);
        if (error) throw error;
      }

      for (const t of cleaned.filter((x) => !!x.id)) {
        const { error } = await supabase
          .from("drillhole_component_types")
          .update({
            key: t.key,
            name: t.name,
            category: t.category,
            icon: t.icon,
            color: t.color,
            sort_order: t.sort_order,
            is_active: t.is_active,
            details_schema: t.details_schema,
          })
          .eq("id", t.id);
        if (error) throw error;
      }

      toast.success("Component types saved");
      await reloadComponentTypes();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save component types");
    } finally {
      setComponentTypesSaving(false);
    }
  };

  // Load geology intervals when hole changes (existing)
  useEffect(() => {
    if (!selectedHoleOrgId || !selectedHoleId) {
      setGeoRows([]);
      return;
    }
    (async () => {
      setGeoLoading(true);
      const { data, error } = await supabase
        .from("drillhole_geology_intervals")
        .select("id, from_m, to_m, lithology_type_id, notes, created_at")
        .eq("organization_id", selectedHoleOrgId)
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
  }, [selectedHoleOrgId, selectedHoleId, supabase]);

  // NEW: Load construction intervals when hole changes
  useEffect(() => {
    if (!selectedHoleOrgId || !selectedHoleId) {
      setConstructionRows([]);
      return;
    }
    (async () => {
      setConstructionLoading(true);
      const { data, error } = await supabase
        .from("drillhole_construction_intervals")
        .select("id, from_m, to_m, construction_type_id, notes, created_at")
        .eq("organization_id", selectedHoleOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      setConstructionLoading(false);

      if (error) {
        console.error(error);
        toast.error("Could not load construction intervals");
        setConstructionRows([]);
        return;
      }

      setConstructionRows(
        (data || []).map((r) => ({
          id: r.id,
          from_m: r.from_m ?? "",
          to_m: r.to_m ?? "",
          construction_type_id: r.construction_type_id || "",
          notes: r.notes || "",
        }))
      );
    })();
  }, [selectedHoleOrgId, selectedHoleId, supabase]);

  // NEW: Load annulus intervals when hole changes
  useEffect(() => {
    if (!selectedHoleOrgId || !selectedHoleId) {
      setAnnulusRows([]);
      return;
    }
    (async () => {
      setAnnulusLoading(true);
      const { data, error } = await supabase
        .from("drillhole_annulus_intervals")
        .select("id, from_m, to_m, annulus_type_id, notes, created_at")
        .eq("organization_id", selectedHoleOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      setAnnulusLoading(false);

      if (error) {
        console.error(error);
        toast.error("Could not load annulus intervals");
        setAnnulusRows([]);
        return;
      }

      setAnnulusRows(
        (data || []).map((r) => ({
          id: r.id,
          from_m: r.from_m ?? "",
          to_m: r.to_m ?? "",
          annulus_type_id: r.annulus_type_id || "",
          notes: r.notes || "",
        }))
      );
    })();
  }, [selectedHoleOrgId, selectedHoleId, supabase]);

  useEffect(() => {
    if (!selectedHoleOrgId || !selectedHoleId) {
      setComponentRows([]);
      return;
    }
    (async () => {
      setComponentLoading(true);
      const { data, error } = await supabase
        .from("drillhole_components")
        .select("id, depth_m, component_type_id, label, status, details, notes, created_at")
        .eq("organization_id", selectedHoleOrgId)
        .eq("hole_id", selectedHoleId)
        .order("depth_m", { ascending: true });

      setComponentLoading(false);

      if (error) {
        console.error(error);
        toast.error("Could not load components");
        setComponentRows([]);
        return;
      }

      setComponentRows(
        (data || []).map((r) => ({
          id: r.id,
          depth_m: r.depth_m ?? "",
          component_type_id: r.component_type_id || "",
          label: r.label || "",
          status: r.status || "installed",
          details: r.details || {},
          notes: r.notes || "",
        }))
      );
    })();
  }, [selectedHoleOrgId, selectedHoleId, supabase]);

  const addGeoRow = () => {
    setGeoRows((prev) => [
      ...(prev || []),
      {
        id: null,
        from_m: nextIntervalFromM(prev), // CHANGED: default start depth
        to_m: "",
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

  // NEW: Construction interval row helpers
  const addConstructionRow = () => {
    setConstructionRows((prev) => [
      ...(prev || []),
      {
        id: null,
        from_m: nextIntervalFromM(prev), // CHANGED: default start depth
        to_m: "",
        construction_type_id: constructionTypesActive?.[0]?.id || "",
        notes: "",
      },
    ]);
  };

  const updateConstructionRow = (idx, patch) => {
    setConstructionRows((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeConstructionRow = (idx) => {
    setConstructionRows((prev) => {
      const next = [...(prev || [])];
      next.splice(idx, 1);
      return next;
    });
  };

  // NEW: Annulus interval row helpers
  const addAnnulusRow = () => {
    setAnnulusRows((prev) => [
      ...(prev || []),
      {
        id: null,
        from_m: nextIntervalFromM(prev), // CHANGED: default start depth
        to_m: "",
        annulus_type_id: annulusTypesActive?.[0]?.id || "",
        notes: "",
      },
    ]);
  };

  const updateAnnulusRow = (idx, patch) => {
    setAnnulusRows((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeAnnulusRow = (idx) => {
    setAnnulusRows((prev) => {
      const next = [...(prev || [])];
      next.splice(idx, 1);
      return next;
    });
  };

  const addComponentRow = () => {
    setComponentRows((prev) => [
      ...(prev || []),
      {
        id: null,
        depth_m: "",
        component_type_id: componentTypesActive?.[0]?.id || "",
        label: "",
        status: "installed",
        details: {},
        notes: "",
      },
    ]);
  };

  const updateComponentRow = (idx, patch) => {
    setComponentRows((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeComponentRow = (idx) => {
    setComponentRows((prev) => {
      const next = [...(prev || [])];
      next.splice(idx, 1);
      return next;
    });
  };

  const validateAndNormalizeComponents = (rows) => {
    const prepared = [];
    for (const row of rows || []) {
      const hasAnyValue =
        String(row?.depth_m ?? "").trim() !== "" ||
        String(row?.component_type_id ?? "").trim() !== "" ||
        String(row?.label ?? "").trim() !== "" ||
        String(row?.notes ?? "").trim() !== "" ||
        Object.keys(row?.details || {}).length > 0;

      if (!hasAnyValue) continue;

      const depth = Number(row?.depth_m);
      if (!Number.isFinite(depth) || depth < 0) {
        return { ok: false, message: "Each component needs a depth of 0m or greater." };
      }
      if (!row?.component_type_id) {
        return { ok: false, message: "Each component needs a type." };
      }

      const details = row?.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {};

      prepared.push({
        depth_m: roundToTenth(depth),
        component_type_id: row.component_type_id,
        label: String(row?.label || "").trim() || null,
        status: String(row?.status || "installed").trim() || "installed",
        details,
        notes: String(row?.notes || "").trim() || null,
      });
    }

    prepared.sort((a, b) => a.depth_m - b.depth_m);
    return { ok: true, rows: prepared };
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

  // NEW: Save construction (replace-all, like geology)
  const saveConstruction = async () => {
    if (!selectedOrgId || !selectedHoleId) return;

    const v = validateAndNormalizeConstructionIntervals(constructionRows);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }

    try {
      setConstructionSaving(true);

      const { error: delErr } = await supabase
        .from("drillhole_construction_intervals")
        .delete()
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId);

      if (delErr) throw delErr;

      const payload = (v.rows || []).map((r) => ({
        organization_id: selectedOrgId,
        hole_id: selectedHoleId,
        construction_type_id: r.construction_type_id,
        from_m: r.from_m,
        to_m: r.to_m,
        notes: r.notes || null,
      }));

      if (payload.length) {
        const { error: insErr } = await supabase.from("drillhole_construction_intervals").insert(payload);
        if (insErr) throw insErr;
      }

      toast.success("Construction saved");

      const { data, error } = await supabase
        .from("drillhole_construction_intervals")
        .select("id, from_m, to_m, construction_type_id, notes")
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      if (!error) {
        setConstructionRows(
          (data || []).map((r) => ({
            id: r.id,
            from_m: r.from_m ?? "",
            to_m: r.to_m ?? "",
            construction_type_id: r.construction_type_id || "",
            notes: r.notes || "",
          }))
        );
      }
    } catch (e) {
      console.error(e);
      // If DB exclusion constraint fires, Supabase usually returns a generic message; still show it.
      toast.error(e?.message || "Failed to save construction");
    } finally {
      setConstructionSaving(false);
    }
  };

  // NEW: Save annulus (replace-all, like geology/construction)
  const saveAnnulus = async () => {
    if (!selectedOrgId || !selectedHoleId) return;

    const v = validateAndNormalizeAnnulusIntervals(annulusRows);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }

    try {
      setAnnulusSaving(true);

      const { error: delErr } = await supabase
        .from("drillhole_annulus_intervals")
        .delete()
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId);

      if (delErr) throw delErr;

      const payload = (v.rows || []).map((r) => ({
        organization_id: selectedOrgId,
        hole_id: selectedHoleId,
        annulus_type_id: r.annulus_type_id,
        from_m: r.from_m,
        to_m: r.to_m,
        notes: r.notes || null,
      }));

      if (payload.length) {
        const { error: insErr } = await supabase.from("drillhole_annulus_intervals").insert(payload);
        if (insErr) throw insErr;
      }

      toast.success("Annulus saved");

      const { data, error } = await supabase
        .from("drillhole_annulus_intervals")
        .select("id, from_m, to_m, annulus_type_id, notes")
        .eq("organization_id", selectedOrgId)
        .eq("hole_id", selectedHoleId)
        .order("from_m", { ascending: true });

      if (!error) {
        setAnnulusRows(
          (data || []).map((r) => ({
            id: r.id,
            from_m: r.from_m ?? "",
            to_m: r.to_m ?? "",
            annulus_type_id: r.annulus_type_id || "",
            notes: r.notes || "",
          }))
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save annulus");
    } finally {
      setAnnulusSaving(false);
    }
  };

  const saveComponents = async () => {
    if (!selectedHoleOrgId || !selectedHoleId) return;

    const v = validateAndNormalizeComponents(componentRows);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }

    try {
      setComponentSaving(true);

      const { error: delErr } = await supabase
        .from("drillhole_components")
        .delete()
        .eq("organization_id", selectedHoleOrgId)
        .eq("hole_id", selectedHoleId);

      if (delErr) throw delErr;

      const payload = (v.rows || []).map((r) => ({
        organization_id: selectedHoleOrgId,
        hole_id: selectedHoleId,
        component_type_id: r.component_type_id,
        depth_m: r.depth_m,
        label: r.label,
        status: r.status,
        details: r.details,
        notes: r.notes,
      }));

      if (payload.length) {
        const { error: insErr } = await supabase.from("drillhole_components").insert(payload);
        if (insErr) throw insErr;
      }

      toast.success("Components saved");

      const { data, error } = await supabase
        .from("drillhole_components")
        .select("id, depth_m, component_type_id, label, status, details, notes")
        .eq("organization_id", selectedHoleOrgId)
        .eq("hole_id", selectedHoleId)
        .order("depth_m", { ascending: true });

      if (!error) {
        setComponentRows(
          (data || []).map((r) => ({
            id: r.id,
            depth_m: r.depth_m ?? "",
            component_type_id: r.component_type_id || "",
            label: r.label || "",
            status: r.status || "installed",
            details: r.details || {},
            notes: r.notes || "",
          }))
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save components");
    } finally {
      setComponentSaving(false);
    }
  };

  // Load holes (existing)
  useEffect(() => {
    if (!selectedOrgId) return;
    (async () => {
      setLoading(true);
      let data = [];
      let error = null;

      if (projectScope === "shared") {
        const { data: sharedRows, error: sharedErr } = await supabase
          .from("organization_shared_projects")
          .select("project_id, relationship:relationship_id(vendor_organization_id,status,permissions,accepted_at)")
          .limit(5000);

        if (sharedErr) {
          console.error(sharedErr);
          toast.error("Could not load shared projects");
          setHoles([]);
          setSelectedHoleId("");
          setLoading(false);
          return;
        }

        const sharedProjectIds = Array.from(
          new Set(
            (sharedRows || [])
              .filter((row) => {
                const rel = row.relationship;
                if (!rel) return false;
                const status = String(rel.status || "");
                const accepted = status === "active" || status === "accepted" || !!rel.accepted_at;
                const allowed = !!rel.permissions?.share_project_details;
                return rel.vendor_organization_id === selectedOrgId && accepted && allowed;
              })
              .map((row) => row.project_id)
              .filter(Boolean)
          )
        );

        if (sharedProjectIds.length) {
          const res = await supabase
            .from("holes")
            .select("id, organization_id, hole_id, project_id, depth, planned_depth, water_level_m, azimuth, dip, collar_longitude, collar_latitude, collar_easting, collar_northing, collar_elevation_m, collar_source, started_at, completed_at, completion_status, completion_notes, projects ( id, name, coordinate_crs_code, coordinate_crs_name )")
            .in("project_id", sharedProjectIds)
            .neq("organization_id", selectedOrgId)
            .order("project_id", { ascending: true })
            .order("hole_id", { ascending: true });
          data = res.data || [];
          error = res.error || null;
        }
      } else {
        const res = await supabase
          .from("holes")
          .select("id, organization_id, hole_id, project_id, depth, planned_depth, water_level_m, azimuth, dip, collar_longitude, collar_latitude, collar_easting, collar_northing, collar_elevation_m, collar_source, started_at, completed_at, completion_status, completion_notes, projects ( id, name, coordinate_crs_code, coordinate_crs_name )")
          .eq("organization_id", selectedOrgId)
          .order("project_id", { ascending: true })
          .order("hole_id", { ascending: true });
        data = res.data || [];
        error = res.error || null;
      }

      if (error) {
        console.error(error);
        toast.error("Could not load holes");
        setHoles([]);
        setLoading(false);
        return;
      }

      setHoles(
        (data || []).map((h) => ({
          ...(() => {
            const derived = deriveHoleCoordinates({
              collarLongitude: h.collar_longitude ?? null,
              collarLatitude: h.collar_latitude ?? null,
              collarEasting: h.collar_easting ?? null,
              collarNorthing: h.collar_northing ?? null,
              projectCrsCode: h.projects?.coordinate_crs_code ?? null,
            });

            return {
              collar_longitude: derived.collarLongitude,
              collar_latitude: derived.collarLatitude,
              collar_easting: h.collar_easting ?? null,
              collar_northing: h.collar_northing ?? null,
            };
          })(),
          id: h.id,
          organization_id: h.organization_id,
          hole_id: h.hole_id,
          project_id: h.project_id ?? null,
          projects: h.projects ?? null, // <-- keep joined project info
          depth: h.depth ?? null,
          planned_depth: h.planned_depth ?? null,
          water_level_m: h.water_level_m ?? null,
          azimuth: h.azimuth ?? null,
          dip: h.dip ?? null,
          collar_elevation_m: h.collar_elevation_m ?? null,
          collar_source: h.collar_source ?? null,
          started_at: h.started_at ?? null,
          completed_at: h.completed_at ?? null,
          completion_status: h.completion_status ?? null,
          completion_notes: h.completion_notes ?? null,
        }))
      );
      setSelectedHoleId((prev) => ((data || []).some((h) => h.id === prev) ? prev : ""));
      setLoading(false);
    })();
  }, [supabase, selectedOrgId, projectScope]);

  const canSeeTypesTab = myRole === "admin" && !isSharedScope;

  const canEditHole = canEdit;

  const onSelectHole = (holeId) => {
    setSelectedHoleId(holeId);
    setDrawerTab("attributes");
    setDrawerOpen(true);
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  const exportDisabledReason = useMemo(() => {
    if (!selectedHole) return "Select a hole first";
    if (exportingPdf) return "Exporting…";
    return "";
  }, [selectedHole, exportingPdf]);

  const onExportPdf = async () => {
    if (!selectedHole || exportingPdf) return;

    const el = document.getElementById("schematic-export-root");
    if (!el) {
      toast.error("Could not find the schematic to export.");
      return;
    }

    try {
      setExportingPdf(true);

      await exportSchematicPdf({
        element: el,
        filename: `Schematic-${selectedHole.hole_id || "hole"}.pdf`,
        hole: selectedHole,
        geologyIntervals: geoRows,
        annulusIntervals: annulusRows,
        constructionIntervals: constructionRows,
        resolveGeologyType: (r) => {
          const t = lithById?.get?.(r.lithology_type_id);
          return { name: t?.name || "", color: t?.color || "" };
        },
        resolveAnnulusType: (r) => {
          const t = annulusById?.get?.(r.annulus_type_id);
          return { name: t?.name || "", color: t?.color || "" };
        },
        resolveConstructionType: (r) => {
          const t = constructionById?.get?.(r.construction_type_id);
          return { name: t?.name || "", color: t?.color || "" };
        },
        backgroundColor: "#0b1220",
        pixelRatio: 3,
        marginMm: 10,
      });
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const updatePlannedDepth = async () => {
    if (!selectedHole) return;
    if (!selectedHole.project_id) {
      toast.error("Assign the hole to a project in Hole Details before saving.");
      return;
    }

    const trimmed = String(plannedDepthInput ?? "").trim();
    const next = trimmed === "" ? null : Number(trimmed);

    if (next !== null && (!Number.isFinite(next) || next <= 0)) {
      toast.error("Planned depth must be a number > 0 (or blank to unset).");
      return;
    }

    try {
      setSavingPlannedDepth(true);

      const { error } = await supabase.from("holes").update({ planned_depth: next }).eq("id", selectedHole.id);
      if (error) throw error;

      setHoles((prev) => (prev || []).map((h) => (h.id === selectedHole.id ? { ...h, planned_depth: next } : h)));
      toast.success("Planned depth saved");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Could not save planned depth");
    } finally {
      setSavingPlannedDepth(false);
    }
  };

  // NEW
  const saveWaterLevel = async () => {
    if (!selectedOrgId || !selectedHoleId) return;

    const raw = String(waterLevelInput ?? "").trim();
    const value = raw === "" ? null : Number(raw);

    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Water level must be a number ≥ 0 (or blank).");
      return;
    }

    try {
      setSavingWaterLevel(true);

      const { error } = await supabase
        .from("holes")
        .update({ water_level_m: value })
        .match({ id: selectedHoleId, organization_id: selectedHoleOrgId });

      if (error) throw error;

      setHoles((prev) =>
        (prev || []).map((h) => (h.id === selectedHoleId ? { ...h, water_level_m: value } : h))
      );

      toast.success("Water level saved");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save water level");
    } finally {
      setSavingWaterLevel(false);
    }
  };

  const handleAttributeChange = (key, value) => {
    setAttributeTouched((prev) => ({ ...prev, [key]: true }));
    setAttributeInputs((prev) => ({ ...prev, [key]: value }));
  };

  const toIsoOrNull = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const saveAdditionalAttributes = async () => {
    if (!selectedHoleId || !selectedHoleOrgId) return;
    if (!selectedHole?.project_id) {
      toast.error("Assign the hole to a project in Hole Details before saving.");
      return;
    }

    const numOrNull = (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const az = numOrNull(attributeInputs.azimuth);
    const dip = numOrNull(attributeInputs.dip);
    const easting = numOrNull(attributeInputs.collar_easting);
    const northing = numOrNull(attributeInputs.collar_northing);
    const lon = numOrNull(attributeInputs.collar_longitude);
    const lat = numOrNull(attributeInputs.collar_latitude);
    const startedAt = toIsoOrNull(attributeInputs.started_at);
    const completedAt = toIsoOrNull(attributeInputs.completed_at);
    const projectedCoordinates = deriveHoleCoordinates({
      collarLongitude: null,
      collarLatitude: null,
      collarEasting: easting,
      collarNorthing: northing,
      projectCrsCode: selectedHole?.projects?.coordinate_crs_code ?? null,
    });
    const effectiveLongitude = easting != null && northing != null ? projectedCoordinates.collarLongitude : lon;
    const effectiveLatitude = easting != null && northing != null ? projectedCoordinates.collarLatitude : lat;

    if (attributeInputs.azimuth !== "" && az == null) return toast.error("Azimuth must be a number.");
    if (attributeInputs.dip !== "" && dip == null) return toast.error("Dip must be a number.");
    if (attributeInputs.collar_easting !== "" && easting == null) return toast.error("Easting must be a number.");
    if (attributeInputs.collar_northing !== "" && northing == null) return toast.error("Northing must be a number.");
    if (attributeInputs.collar_longitude !== "" && lon == null) return toast.error("Longitude must be a number.");
    if (attributeInputs.collar_latitude !== "" && lat == null) return toast.error("Latitude must be a number.");
    if ((easting == null) !== (northing == null)) return toast.error("Easting and northing must both be provided or both be blank.");
    if ((easting != null || northing != null) && !selectedHole?.project_id) return toast.error("Assign the hole to a project before entering projected coordinates.");
    if ((easting != null || northing != null) && !selectedHole?.projects?.coordinate_crs_code) return toast.error("Set the project CRS before saving projected coordinates.");
    if ((lon == null) !== (lat == null)) return toast.error("Longitude and latitude must both be provided or both be blank.");
    if (effectiveLongitude == null || effectiveLatitude == null) return toast.error("Enter either longitude and latitude or easting and northing.");
    if (az != null && (az < 0 || az >= 360)) return toast.error("Azimuth must be between 0 and < 360.");
    if (dip != null && (dip < -90 || dip > 90)) return toast.error("Dip must be between -90 and 90.");
    if (startedAt == null && String(attributeInputs.started_at || "").trim()) return toast.error("Started at is invalid.");
    if (completedAt == null && String(attributeInputs.completed_at || "").trim()) return toast.error("Completed at is invalid.");

    try {
      setSavingAdditionalAttributes(true);

      const payload = {
        azimuth: az,
        dip,
        collar_longitude: effectiveLongitude,
        collar_latitude: effectiveLatitude,
        collar_easting: easting,
        collar_northing: northing,
        collar_elevation_m: numOrNull(attributeInputs.collar_elevation_m),
        collar_source: String(attributeInputs.collar_source || "").trim() || null,
        started_at: startedAt,
        completed_at: completedAt,
        completion_status: String(attributeInputs.completion_status || "").trim() || null,
        completion_notes: String(attributeInputs.completion_notes || "").trim() || null,
      };

      const { error } = await supabase.from("holes").update(payload).match({ id: selectedHoleId, organization_id: selectedHoleOrgId });
      if (error) throw error;

      setHoles((prev) =>
        (prev || []).map((h) =>
          h.id === selectedHoleId
            ? {
                ...h,
                ...payload,
              }
            : h
        )
      );

      toast.success("Additional attributes saved");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save additional attributes");
    } finally {
      setSavingAdditionalAttributes(false);
    }
  };

  const totalProjects = projects.length;
  const totalHoles = holes.length;
  const totalShared = holes.filter((hole) => hole.organization_id !== selectedOrgId).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#04111f_0%,_#020617_42%,_#02030a_100%)] px-3 pb-24 pt-2 md:px-5 md:pb-8 md:pt-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <section className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/40 shadow-[0_30px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl xl:block">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(8,47,73,0.65)_45%,rgba(120,53,15,0.48))] px-4 py-5 md:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                  Spatial Drillhole Workspace
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">Inspect drillhole intervals, attributes, and schematic output in one place.</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                    Use the navigator to move between projects and holes, then edit attributes and interval data while previewing the full borehole schematic beside it.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-[420px] xl:max-w-[520px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visible Projects</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalProjects}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Loaded Holes</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalHoles}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Shared In View</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalShared}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_30px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(8,47,73,0.28),transparent)]" />
          <div className="relative flex flex-col gap-3 border-b border-white/10 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className={[
                  "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  "border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg shadow-black/30 text-slate-100 hover:border-white/30 hover:bg-white/15",
                  "active:scale-95 transition-base focus-ring",
                ].join(" ")}
                onClick={() => setDrawerOpen((v) => !v)}
                title={drawerOpen ? "Collapse attributes pane" : "Expand attributes pane"}
                aria-label={drawerOpen ? "Collapse attributes pane" : "Expand attributes pane"}
              >
                <span className="relative text-base leading-none text-slate-100/95">{drawerOpen ? "◀" : "▶"}</span>
              </button>

              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Drillhole Viz</div>
                <div className="mt-1 truncate text-lg font-semibold text-white">
                  {selectedHole ? `Schematic: ${selectedHole.hole_id}` : "Hole schematic workspace"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalHoles} loaded holes</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{selectedHole ? selectedHole.hole_id : "No selection"}</span>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {!externalProjectScope && (
                <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/45 p-1.5 md:w-auto">
                  <button
                    type="button"
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)]" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setLocalProjectScope("own")}
                  >
                    My Projects
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.25)]" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setLocalProjectScope("shared")}
                  >
                    Client Shared
                  </button>
                </div>
              )}

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#38bdf8)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onExportPdf}
                disabled={!!exportDisabledReason}
                title={exportDisabledReason || "Export PDF"}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="flex min-h-[68svh] flex-1">
        {/* Left drawer */}
        <div
          className={[
            "h-full shrink-0 overflow-hidden border-r border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.24)] backdrop-blur-xl",
            drawerOpen ? "w-[460px] xl:w-[520px] max-w-[92vw]" : "w-0 border-r-0",
            "transition-all duration-200 overflow-hidden",
          ].join(" ")}
        >
          <div className="h-full flex flex-col">
            {/* Tabs */}
            {drawerOpen && (
              <div className="border-b border-white/10 px-4 py-4 md:px-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Project Navigator</div>
                  <div className="mt-1 text-lg font-semibold text-white">Projects and intervals</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-1">
                  <TabButton active={drawerTab === "hole"} onClick={() => setDrawerTab("hole")} label="Hole" />
                  <TabButton
                    active={drawerTab === "attributes"}
                    onClick={() => setDrawerTab("attributes")}
                    label="Attributes"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />
                  <TabButton
                    active={drawerTab === "geology"}
                    onClick={() => setDrawerTab("geology")}
                    label="Geology"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />
                  <TabButton
                    active={drawerTab === "construction"}
                    onClick={() => setDrawerTab("construction")}
                    label="Construction"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />
                  <TabButton
                    active={drawerTab === "components"}
                    onClick={() => setDrawerTab("components")}
                    label="Components"
                    disabled={!selectedHoleId}
                    title={!selectedHoleId ? "Select a hole first" : ""}
                  />
                  <TabButton
                    active={drawerTab === "annulus"}
                    onClick={() => setDrawerTab("annulus")}
                    label="Annulus"
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
            <div className="flex-1 overflow-auto p-4 md:p-5">
              {!drawerOpen ? null : loading ? (
                <div className="text-sm text-slate-300">Loading…</div>
              ) : drawerTab === "hole" ? (
                <HoleTab
                  selectedOrgId={selectedOrgId}
                  projects={projects}
                  expandedProjects={expandedProjects}
                  selectedHoleId={selectedHoleId}
                  onToggleProject={(projectId) =>
                    setExpandedProjects((m) => ({
                      ...(m || {}),
                      [projectId]: !(m || {})[projectId],
                    }))
                  }
                  onSelectHole={onSelectHole}
                />
              ) : drawerTab === "attributes" ? (
                <AttributesTab
                  selectedHole={selectedHole}
                  canEditHole={canEditHole}
                  plannedDepthInput={plannedDepthInput}
                  savingPlannedDepth={savingPlannedDepth}
                  onPlannedDepthChange={setPlannedDepthInput}
                  onSavePlannedDepth={updatePlannedDepth} // <-- FIX (was savePlannedDepth)
                  waterLevelInput={waterLevelInput}
                  savingWaterLevel={savingWaterLevel}
                  onWaterLevelChange={setWaterLevelInput}
                  onSaveWaterLevel={saveWaterLevel}
                  azimuthInput={attributeInputs.azimuth}
                  dipInput={attributeInputs.dip}
                  collarLongitudeInput={attributeTouched.collar_longitude ? attributeInputs.collar_longitude : (selectedHole?.collar_longitude ?? attributeInputs.collar_longitude)}
                  collarLatitudeInput={attributeTouched.collar_latitude ? attributeInputs.collar_latitude : (selectedHole?.collar_latitude ?? attributeInputs.collar_latitude)}
                  collarEastingInput={attributeInputs.collar_easting}
                  collarNorthingInput={attributeInputs.collar_northing}
                  collarElevationInput={attributeInputs.collar_elevation_m}
                  collarSourceInput={attributeInputs.collar_source}
                  projectCrsLabel={(() => {
                    const selectedCrs = getAustralianProjectCrsByCode(selectedHole?.projects?.coordinate_crs_code);
                    if (selectedCrs) return `${selectedCrs.name} (${selectedCrs.code})`;
                    return selectedHole?.projects?.coordinate_crs_name || selectedHole?.projects?.coordinate_crs_code || "";
                  })()}
                  startedAtInput={attributeInputs.started_at}
                  completedAtInput={attributeInputs.completed_at}
                  completionStatusInput={attributeInputs.completion_status}
                  completionNotesInput={attributeInputs.completion_notes}
                  onAttributesChange={handleAttributeChange}
                  onSaveAdditionalAttributes={saveAdditionalAttributes}
                  savingAdditionalAttributes={savingAdditionalAttributes}
                />
              ) : drawerTab === "geology" ? (
                <GeologyIntervalsTab
                  selectedHole={selectedHole}
                  canEdit={canEdit}
                  geoLoading={geoLoading}
                  geoSaving={geoSaving}
                  geoRows={geoRows}
                  lithologyTypesActive={lithologyTypesActive}
                  lithById={lithById}
                  onAddRow={addGeoRow}
                  onSave={saveGeology}
                  onUpdateRow={updateGeoRow}
                  onRemoveRow={removeGeoRow}
                />
              ) : drawerTab === "construction" ? (
                <ConstructionIntervalsTab
                  selectedHole={selectedHole}
                  canEdit={canEdit}
                  constructionLoading={constructionLoading}
                  constructionSaving={constructionSaving}
                  constructionRows={constructionRows}
                  constructionTypesActive={constructionTypesActive}
                  constructionById={constructionById}
                  onAddRow={addConstructionRow}
                  onSave={saveConstruction}
                  onUpdateRow={updateConstructionRow}
                  onRemoveRow={removeConstructionRow}
                />
              ) : drawerTab === "annulus" ? (
                <AnnulusIntervalsTab
                  selectedHole={selectedHole}
                  canEdit={canEdit}
                  annulusLoading={annulusLoading}
                  annulusSaving={annulusSaving}
                  annulusRows={annulusRows}
                  annulusTypesActive={annulusTypesActive}
                  annulusById={annulusById}
                  onAddRow={addAnnulusRow}
                  onSave={saveAnnulus}
                  onUpdateRow={updateAnnulusRow}
                  onRemoveRow={removeAnnulusRow}
                />
              ) : drawerTab === "components" ? (
                <ComponentsTab
                  selectedHole={selectedHole}
                  canEdit={canEdit}
                  componentLoading={componentLoading}
                  componentSaving={componentSaving}
                  componentRows={componentRows}
                  componentTypesActive={componentTypesActive}
                  componentById={componentById}
                  onAddRow={addComponentRow}
                  onSave={saveComponents}
                  onUpdateRow={updateComponentRow}
                  onRemoveRow={removeComponentRow}
                />
              ) : drawerTab === "types" ? (
                <TypesTabs
                  myRole={myRole}
                  canEdit={canEdit}
                  lithologyTypesAll={lithologyTypesAll}
                  lithologyLoading={typesLoading}
                  lithologySaving={typesSaving}
                  onAddLithologyType={addLithologyTypeRow}
                  onSaveLithologyTypes={saveLithologyTypes}
                  onUpdateLithologyType={updateLithologyTypeRow}
                  onDeleteLithologyType={deleteLithologyType}
                  constructionTypesAll={constructionTypesAll}
                  constructionLoading={constructionTypesLoading}
                  constructionSaving={constructionTypesSaving}
                  onAddConstructionType={addConstructionTypeRow}
                  onSaveConstructionTypes={saveConstructionTypes}
                  onUpdateConstructionType={updateConstructionTypeRow}
                  onDeleteConstructionType={deleteConstructionType}
                  annulusTypesAll={annulusTypesAll}
                  annulusLoading={annulusTypesLoading}
                  annulusSaving={annulusTypesSaving}
                  onAddAnnulusType={addAnnulusTypeRow}
                  onSaveAnnulusTypes={saveAnnulusTypes}
                  onUpdateAnnulusType={updateAnnulusTypeRow}
                  onDeleteAnnulusType={deleteAnnulusType}
                  componentTypesAll={componentTypesAll}
                  componentTypesLoading={componentTypesLoading}
                  componentTypesSaving={componentTypesSaving}
                  onAddComponentType={addComponentTypeRow}
                  onSaveComponentTypes={saveComponentTypes}
                  onUpdateComponentType={updateComponentTypeRow}
                  onDeleteComponentType={deleteComponentType}
                />
              ) : (
                <div className="text-sm text-slate-300">Unknown tab: {drawerTab}</div>
              )}
            </div>
          </div>
        </div>

        <SchematicArea
          selectedHole={selectedHole}
          geoRows={geoRows}
          lithById={lithById}
          constructionRows={constructionRows}
          constructionById={constructionById}
          annulusRows={annulusRows}
          annulusById={annulusById}
          componentRows={componentRows}
          componentById={componentById}
          onExportPdf={onExportPdf}
          exportDisabledReason={exportDisabledReason}
        />
          </div>
        </section>
      </div>
    </div>
  );
}