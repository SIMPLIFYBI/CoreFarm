"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";
import TabButton from "./components/TabButton";
import GeologyIntervalsTab from "./components/GeologyIntervalsTab";
import ConstructionIntervalsTab from "./components/ConstructionIntervalsTab";
import AnnulusIntervalsTab from "./components/AnnulusIntervalsTab";
import HoleTab from "./components/HoleTab";
import AttributesTab from "./components/AttributesTab";
import SchematicArea from "./components/SchematicArea";
import TypesTabs from "./components/TypesTabs";

export default function DrillholeVizPage() {
  const supabase = supabaseBrowser();
  const { orgId: selectedOrgId, memberships } = useOrg();

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

  // --- NEW: Annulus intervals (hole-level)
  const [annulusRows, setAnnulusRows] = useState([]);
  const [annulusLoading, setAnnulusLoading] = useState(false);
  const [annulusSaving, setAnnulusSaving] = useState(false);

  // Roles in schema are admin/member (no editor). Keep this permissive; RLS will enforce actual rights.
  const canEdit = myRole === "admin" || myRole === "member";

  const selectedHole = useMemo(() => {
    return (holes || []).find((h) => h.id === selectedHoleId) || null;
  }, [holes, selectedHoleId]);

  // Keep the planned depth editor in sync with the selected hole
  useEffect(() => {
    if (!selectedHole) {
      setPlannedDepthInput("");
      setWaterLevelInput("");
      return;
    }

    setPlannedDepthInput(selectedHole.planned_depth ?? "");
    setWaterLevelInput(selectedHole.water_level_m ?? "");
  }, [selectedHole?.id, selectedHole?.planned_depth, selectedHole?.water_level_m]);

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

  const roundToTenth = (v) => {
    if (v === "" || v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return Math.round(n * 10) / 10;
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

  const reloadConstructionTypes = async () => {
    if (!selectedOrgId) {
      setConstructionTypesAll([]);
      return;
    }
    setConstructionTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_construction_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", selectedOrgId)
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
  const reloadAnnulusTypes = async () => {
    if (!selectedOrgId) {
      setAnnulusTypesAll([]);
      return;
    }
    setAnnulusTypesLoading(true);

    const { data, error } = await supabase
      .from("drillhole_annulus_types")
      .select("id, name, color, sort_order, is_active, created_at")
      .eq("organization_id", selectedOrgId)
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

  useEffect(() => {
    reloadLithologyTypes();
    reloadConstructionTypes();
    reloadAnnulusTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

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

  // Load geology intervals when hole changes (existing)
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

  // NEW: Load construction intervals when hole changes
  useEffect(() => {
    if (!selectedOrgId || !selectedHoleId) {
      setConstructionRows([]);
      return;
    }
    (async () => {
      setConstructionLoading(true);
      const { data, error } = await supabase
        .from("drillhole_construction_intervals")
        .select("id, from_m, to_m, construction_type_id, notes, created_at")
        .eq("organization_id", selectedOrgId)
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
  }, [selectedOrgId, selectedHoleId, supabase]);

  // NEW: Load annulus intervals when hole changes
  useEffect(() => {
    if (!selectedOrgId || !selectedHoleId) {
      setAnnulusRows([]);
      return;
    }
    (async () => {
      setAnnulusLoading(true);
      const { data, error } = await supabase
        .from("drillhole_annulus_intervals")
        .select("id, from_m, to_m, annulus_type_id, notes, created_at")
        .eq("organization_id", selectedOrgId)
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
  }, [selectedOrgId, selectedHoleId, supabase]);

  const addGeoRow = () => {
    setGeoRows((prev) => [
      ...(prev || []),
      { id: null, from_m: "", to_m: "", lithology_type_id: lithologyTypesActive?.[0]?.id || "", notes: "" },
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
        from_m: "",
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
      { id: null, from_m: "", to_m: "", annulus_type_id: annulusTypesActive?.[0]?.id || "", notes: "" },
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

  // Load holes (existing)
  useEffect(() => {
    if (!selectedOrgId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("holes")
        .select("id, organization_id, hole_id, project_id, depth, planned_depth, water_level_m, projects ( id, name )")
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

      setHoles(
        (data || []).map((h) => ({
          id: h.id,
          hole_id: h.hole_id,
          project_id: h.project_id ?? null,
          projects: h.projects ?? null, // <-- keep joined project info
          depth: h.depth ?? null,
          planned_depth: h.planned_depth ?? null,
          water_level_m: h.water_level_m ?? null,
        }))
      );
      setLoading(false);
    })();
  }, [supabase, selectedOrgId]);

  const canSeeTypesTab = myRole === "admin";

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
        .match({ id: selectedHoleId, organization_id: selectedOrgId });

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
            <div className="flex-1 overflow-auto p-3">
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
          onExportPdf={onExportPdf}
          exportDisabledReason={exportDisabledReason}
        />
      </div>
    </div>
  );
}