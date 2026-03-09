"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

const MAP_SCOPE_STORAGE_KEY = "map:projectScope";
const HOLES_SOURCE_ID = "prod-hole-map-source";
const HOLES_GLOW_LAYER_ID = "prod-hole-map-glow";
const HOLES_CIRCLE_LAYER_ID = "prod-hole-map-circles";
const HOLES_SELECTED_LAYER_ID = "prod-hole-map-selected";
const HOLES_LABEL_LAYER_ID = "prod-hole-map-labels";
const DEFAULT_CENTER = [133.7751, -25.2744];
const DEFAULT_ZOOM = 3;
const MAPBOX_STYLE_URL = "mapbox://styles/jamesblue/cmmhkajfi000w01shgzr5c1op";

function getHoleStateTone(state) {
  if (state === "drilled") {
    return {
      label: "Drilled",
      text: "#bbf7d0",
      border: "rgba(34,197,94,0.35)",
      background: "rgba(34,197,94,0.16)",
    };
  }

  if (state === "in_progress") {
    return {
      label: "In Progress",
      text: "#fde68a",
      border: "rgba(251,191,36,0.35)",
      background: "rgba(251,191,36,0.16)",
    };
  }

  return {
    label: state ? String(state).replace(/_/g, " ") : "Proposed",
    text: "#bae6fd",
    border: "rgba(34,211,238,0.35)",
    background: "rgba(34,211,238,0.16)",
  };
}

function formatValue(value, suffix = "") {
  if (value == null || value === "") return "-";
  return `${value}${suffix}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function makeFeatureCollection(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((hole) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(hole.collar_longitude), Number(hole.collar_latitude)],
      },
      properties: {
        id: hole.id,
        hole_id: hole.hole_id || "Unnamed hole",
        project_id: hole.project_id || "",
        project_name: hole.project_name || "No project",
        state: hole.state || "",
        depth: hole.depth ?? "",
        planned_depth: hole.planned_depth ?? "",
        water_level_m: hole.water_level_m ?? "",
        azimuth: hole.azimuth ?? "",
        dip: hole.dip ?? "",
      },
    })),
  };
}

function ProjectAccordionList({
  loading,
  projects,
  expandedProjects,
  onToggleProject,
  selectedHoleId,
  onSelectHole,
  compact = false,
}) {
  if (loading) {
    return (
      <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
        {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
          <div key={index} className={`animate-pulse rounded-2xl bg-white/[0.05] ${compact ? "h-24" : "h-20"}`} />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return <div className="p-5 text-sm text-slate-400">No visible projects with mappable hole coordinates for this scope.</div>;
  }

  return (
    <div className={compact ? "space-y-3 p-4" : "space-y-3 p-4 md:p-5"}>
      {projects.map((project) => {
        const isExpanded = expandedProjects[project.id] === true;
        return (
          <div
            key={project.id}
            className={`overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.66),rgba(2,6,23,0.92))] ${compact ? "rounded-[26px]" : "rounded-3xl"}`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
              onClick={() => onToggleProject(project, isExpanded)}
            >
              <div className="min-w-0">
                <div className={`truncate font-semibold text-white ${compact ? "text-[15px]" : "text-sm"}`}>{project.name}</div>
                <div className="mt-1 text-xs text-slate-400">{project.holes.length} mapped hole{project.holes.length === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                {isExpanded ? "Hide" : "Show"}
              </div>
            </button>

            {isExpanded ? (
              <div className="space-y-2 border-t border-white/10 px-3 py-3">
                {project.holes.map((hole) => {
                  const isSelected = selectedHoleId === hole.id;
                  return (
                    <button
                      key={hole.id}
                      type="button"
                      onClick={() => onSelectHole(hole)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-amber-300/50 bg-amber-300/12 shadow-[0_10px_32px_rgba(251,191,36,0.14)]" : "border-white/8 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{hole.hole_id}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {formatValue(hole.depth, "m")} drilled · {formatValue(hole.planned_depth, "m")} planned
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
                        {hole.state || "-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HoleAttributesPanel({ selectedHole, mobile = false }) {
  if (mobile) {
    return (
      <div className="space-y-3 p-4">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.68)_45%,rgba(120,53,15,0.42))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Selected Hole</div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-white">{selectedHole?.hole_id || "No hole selected"}</div>
              <div className="mt-1 text-sm text-slate-300">{selectedHole?.project_name || "Tap a project or point to inspect detail"}</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
              {selectedHole?.state || "-"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Depth", formatValue(selectedHole?.depth, " m")],
            ["Planned", formatValue(selectedHole?.planned_depth, " m")],
            ["Water", formatValue(selectedHole?.water_level_m, " m")],
            ["Elevation", formatValue(selectedHole?.collar_elevation_m, " m")],
            ["Azimuth", formatValue(selectedHole?.azimuth, "°")],
            ["Dip", formatValue(selectedHole?.dip, "°")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-2 text-base font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/55 p-4">
          {[
            ["Collar Source", selectedHole?.collar_source || "-"],
            ["Longitude", formatValue(selectedHole?.collar_longitude)],
            ["Latitude", formatValue(selectedHole?.collar_latitude)],
            ["Started", formatDateTime(selectedHole?.started_at)],
            ["Completed", formatDateTime(selectedHole?.completed_at)],
            ["Completion Status", selectedHole?.completion_status || "-"],
            ["Completion Notes", selectedHole?.completion_notes || "-"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-100">{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-200">
        <tbody>
          <tr className="border-b border-white/10">
            <th className="w-56 bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Project</th>
            <td className="px-4 py-3">{selectedHole?.project_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Hole ID</th>
            <td className="px-4 py-3">{selectedHole?.hole_id || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">State</th>
            <td className="px-4 py-3">{selectedHole?.state || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Depth</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.depth, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Planned Depth</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.planned_depth, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Water Level</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.water_level_m, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Azimuth</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.azimuth, "°")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Dip</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.dip, "°")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Longitude</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_longitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Latitude</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_latitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Elevation</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_elevation_m, " m")}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Collar Source</th>
            <td className="px-4 py-3">{selectedHole?.collar_source || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Started</th>
            <td className="px-4 py-3">{formatDateTime(selectedHole?.started_at)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completed</th>
            <td className="px-4 py-3">{formatDateTime(selectedHole?.completed_at)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completion Status</th>
            <td className="px-4 py-3">{selectedHole?.completion_status || "-"}</td>
          </tr>
          <tr>
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Completion Notes</th>
            <td className="px-4 py-3">{selectedHole?.completion_notes || "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function HoleMapWorkspace({ publicToken = "" }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId } = useOrg();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxRef = useRef(null);
  const popupRef = useRef(null);
  const handlersBoundRef = useRef(false);
  const mapReadyRef = useRef(false);
  const visibleHolesRef = useRef([]);

  const [projectScope, setProjectScope] = useState("own");
  const [loading, setLoading] = useState(true);
  const [mapStatus, setMapStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [allHoles, setAllHoles] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [expandedProjects, setExpandedProjects] = useState({});
  const [selectedHoleId, setSelectedHoleId] = useState("");
  const [mobilePanelTab, setMobilePanelTab] = useState("projects");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(MAP_SCOPE_STORAGE_KEY);
    if (stored === "own" || stored === "shared") {
      setProjectScope(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MAP_SCOPE_STORAGE_KEY, projectScope);
  }, [projectScope]);

  useEffect(() => {
    const token = String(publicToken || "").trim();

    if (!token) {
      setMapStatus("error");
      setError("Missing NEXT_PUBLIC_MAPBOX_TOKEN in environment.");
      return undefined;
    }

    let disposed = false;

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (disposed || !mapContainerRef.current) return;

        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: MAPBOX_STYLE_URL,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          pitch: 28,
          bearing: -12,
          cooperativeGestures: true,
        });

        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

        map.on("load", () => {
          if (disposed) return;
          mapReadyRef.current = true;
          setMapStatus("ready");
        });

        map.on("error", (evt) => {
          if (disposed) return;
          setMapStatus("error");
          setError(evt?.error?.message || "Mapbox runtime error.");
        });
      } catch (evt) {
        if (disposed) return;
        setMapStatus("error");
        setError(evt?.message || "Failed to initialize Mapbox.");
      }
    };

    void initMap();

    return () => {
      disposed = true;
      handlersBoundRef.current = false;
      mapReadyRef.current = false;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [publicToken]);

  useEffect(() => {
    if (!orgId) {
      setAllHoles([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        let rows = [];

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

          if (sharedProjectIds.length) {
            const { data, error: holesErr } = await supabase
              .from("holes")
              .select(
                "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,projects(id,name)"
              )
              .in("project_id", sharedProjectIds)
              .neq("organization_id", orgId)
              .not("collar_longitude", "is", null)
              .not("collar_latitude", "is", null)
              .order("project_id", { ascending: true })
              .order("hole_id", { ascending: true });

            if (holesErr) throw holesErr;
            rows = data || [];
          }
        } else {
          const { data, error: holesErr } = await supabase
            .from("holes")
            .select(
              "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,projects(id,name)"
            )
            .eq("organization_id", orgId)
            .not("collar_longitude", "is", null)
            .not("collar_latitude", "is", null)
            .order("project_id", { ascending: true })
            .order("hole_id", { ascending: true });

          if (holesErr) throw holesErr;
          rows = data || [];
        }

        if (!active) return;

        setAllHoles(
          rows.map((hole) => ({
            id: hole.id,
            organization_id: hole.organization_id,
            hole_id: hole.hole_id,
            project_id: hole.project_id || "",
            project_name: hole.projects?.name || "No project",
            state: hole.state || "",
            depth: hole.depth ?? null,
            planned_depth: hole.planned_depth ?? null,
            water_level_m: hole.water_level_m ?? null,
            azimuth: hole.azimuth ?? null,
            dip: hole.dip ?? null,
            collar_longitude: hole.collar_longitude ?? null,
            collar_latitude: hole.collar_latitude ?? null,
            collar_elevation_m: hole.collar_elevation_m ?? null,
            collar_source: hole.collar_source ?? null,
            started_at: hole.started_at ?? null,
            completed_at: hole.completed_at ?? null,
            completion_status: hole.completion_status ?? null,
            completion_notes: hole.completion_notes ?? null,
          }))
        );
      } catch (evt) {
        if (!active) return;
        const message = evt?.message || "Failed to load map holes";
        setAllHoles([]);
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [orgId, projectScope, supabase]);

  const projects = useMemo(() => {
    const projectMap = new Map();
    (allHoles || []).forEach((hole) => {
      const key = hole.project_id || "unassigned";
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          id: key,
          name: hole.project_name || "No project",
          holes: [],
        });
      }
      projectMap.get(key).holes.push(hole);
    });

    return Array.from(projectMap.values())
      .map((project) => ({
        ...project,
        holes: project.holes.slice().sort((a, b) => String(a.hole_id || "").localeCompare(String(b.hole_id || ""))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allHoles]);

  const filteredProjects = useMemo(() => {
    if (!projectFilter) return projects;
    return projects.filter((project) => project.id === projectFilter);
  }, [projectFilter, projects]);

  const visibleHoles = useMemo(() => {
    return filteredProjects.flatMap((project) => project.holes);
  }, [filteredProjects]);

  useEffect(() => {
    visibleHolesRef.current = visibleHoles;
  }, [visibleHoles]);

  const selectedHole = useMemo(() => {
    return visibleHoles.find((hole) => hole.id === selectedHoleId) || visibleHoles[0] || null;
  }, [selectedHoleId, visibleHoles]);

  useEffect(() => {
    setExpandedProjects((prev) => {
      const next = { ...prev };
      filteredProjects.forEach((project) => {
        if (typeof next[project.id] === "undefined") next[project.id] = false;
      });
      return next;
    });
  }, [filteredProjects]);

  useEffect(() => {
    if (!visibleHoles.length) {
      setSelectedHoleId("");
      return;
    }
    if (!visibleHoles.some((hole) => hole.id === selectedHoleId)) {
      setSelectedHoleId(visibleHoles[0].id);
    }
  }, [selectedHoleId, visibleHoles]);

  const frameHolesOnMap = (holes) => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    const mappableHoles = (holes || []).filter((hole) => {
      const lng = Number(hole.collar_longitude);
      const lat = Number(hole.collar_latitude);
      return Number.isFinite(lng) && Number.isFinite(lat);
    });

    if (!mappableHoles.length) return;

    if (mappableHoles.length === 1) {
      map.flyTo({ center: [Number(mappableHoles[0].collar_longitude), Number(mappableHoles[0].collar_latitude)], zoom: 11.5, speed: 0.8, curve: 1.2 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    mappableHoles.forEach((hole) => {
      bounds.extend([Number(hole.collar_longitude), Number(hole.collar_latitude)]);
    });

    map.fitBounds(bounds, { padding: { top: 110, right: 90, bottom: 110, left: 90 }, maxZoom: 13, duration: 1200 });
  };

  const renderPopupHtml = (hole) => {
    if (!hole) return "";
    const stateTone = getHoleStateTone(hole.state);

    return `
      <div style="min-width:240px;max-width:260px;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(186,230,253,0.78);">Hole</div>
          <div style="font-size:16px;font-weight:700;line-height:1.2;color:#f8fafc;word-break:break-word;">${hole.hole_id || "Unnamed hole"}</div>
          <div style="font-size:12px;line-height:1.4;color:rgba(226,232,240,0.78);word-break:break-word;">${hole.project_name || "No project"}</div>
          <div style="display:inline-flex;align-self:flex-start;max-width:100%;border:1px solid ${stateTone.border};background:${stateTone.background};color:${stateTone.text};border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;line-height:1.1;">
            ${stateTone.label}
          </div>
        </div>
        <div style="margin-top:14px;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;">
          <div style="border:1px solid rgba(148,163,184,0.18);background:rgba(15,23,42,0.5);border-radius:14px;padding:10px 12px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(148,163,184,0.84);">Depth</div>
            <div style="margin-top:6px;font-size:15px;font-weight:700;color:#f8fafc;">${formatValue(hole.depth, " m")}</div>
          </div>
        </div>
      </div>
    `;
  };

  const focusHole = (hole, options = {}) => {
    if (!hole) return;
    setSelectedHoleId(hole.id);
    setMobilePanelTab("hole");

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const lng = Number(hole.collar_longitude);
    const lat = Number(hole.collar_latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11.5), speed: 0.8, curve: 1.2 });
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true, className: "hole-map-popup" });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderPopupHtml(hole)).addTo(map);
  };

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    const collection = makeFeatureCollection(visibleHoles);

    if (map.getSource(HOLES_SOURCE_ID)) {
      map.getSource(HOLES_SOURCE_ID).setData(collection);
    } else {
      map.addSource(HOLES_SOURCE_ID, { type: "geojson", data: collection });
    }

    if (!map.getLayer(HOLES_GLOW_LAYER_ID)) {
      map.addLayer({
        id: HOLES_GLOW_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": "#22d3ee",
          "circle-opacity": 0.14,
          "circle-blur": 0.85,
        },
      });
    }

    if (!map.getLayer(HOLES_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: HOLES_CIRCLE_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": "#fde047",
          "circle-stroke-color": "#082f49",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0.96,
        },
      });
    }

    if (!map.getLayer(HOLES_SELECTED_LAYER_ID)) {
      map.addLayer({
        id: HOLES_SELECTED_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(249,115,22,0.22)",
          "circle-stroke-color": "#fb923c",
          "circle-stroke-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    if (!map.getLayer(HOLES_LABEL_LAYER_ID)) {
      map.addLayer({
        id: HOLES_LABEL_LAYER_ID,
        type: "symbol",
        source: HOLES_SOURCE_ID,
        layout: {
          "text-field": ["get", "hole_id"],
          "text-size": 11,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.35],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(2, 6, 23, 0.92)",
          "text-halo-width": 1.4,
        },
      });
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHole?.id || ""]);

    if (!handlersBoundRef.current) {
      const setPointerCursor = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const clearPointerCursor = () => {
        map.getCanvas().style.cursor = "";
      };
      const handleHoleLayerClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const hole = visibleHolesRef.current.find((row) => String(row.id) === String(feature.properties?.id));
        if (!hole) return;
        focusHole(hole, { flyTo: false });
      };

      map.on("mouseenter", HOLES_CIRCLE_LAYER_ID, setPointerCursor);
      map.on("mouseenter", HOLES_SELECTED_LAYER_ID, setPointerCursor);
      map.on("mouseleave", HOLES_CIRCLE_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", HOLES_SELECTED_LAYER_ID, clearPointerCursor);
      map.on("click", HOLES_CIRCLE_LAYER_ID, handleHoleLayerClick);
      map.on("click", HOLES_SELECTED_LAYER_ID, handleHoleLayerClick);
      handlersBoundRef.current = true;
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHole?.id || ""]);

    if (!visibleHoles.length) {
      if (popupRef.current) popupRef.current.remove();
      return;
    }
  }, [mapStatus, selectedHole?.id, visibleHoles]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    if (!visibleHoles.length) {
      if (popupRef.current) popupRef.current.remove();
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      return;
    }

    frameHolesOnMap(visibleHoles);
  }, [mapStatus, visibleHoles]);

  const totalProjects = projects.length;
  const totalVisibleProjects = filteredProjects.length;
  const totalVisibleHoles = visibleHoles.length;
  const totalShared = allHoles.filter((hole) => hole.organization_id !== orgId).length;

  const toggleProjectExpanded = (project, isExpanded) => {
    setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }));
    frameHolesOnMap(project.holes);
  };

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
                  <h1 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">Project terrain, collar positions, and drillhole detail in one place.</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                    This map only reveals holes from your organization or projects explicitly shared with it. Use the scope toggle and project filter to move from a whole portfolio view down to a single pattern.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-[420px] xl:max-w-[520px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visible Projects</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleProjects}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mapped Holes</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleHoles}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Shared In View</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalShared}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/45 p-1.5 xl:w-auto">
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)]" : "text-slate-200 hover:bg-white/8"}`}
                  onClick={() => {
                    setProjectScope("own");
                    setProjectFilter("");
                  }}
                >
                  My Projects
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.25)]" : "text-slate-200 hover:bg-white/8"}`}
                  onClick={() => {
                    setProjectScope("shared");
                    setProjectFilter("");
                  }}
                >
                  Client Shared
                </button>
              </div>

              <div>
                <label className="flex min-w-[240px] flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                  Project Filter
                  <select
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                    className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/40"
                  >
                    <option value="">All visible projects ({totalProjects})</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.holes.length})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {error ? <div className="mt-3 text-sm text-rose-300">{error}</div> : null}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[350px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl xl:block">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Project Navigator</div>
                <div className="mt-1 text-lg font-semibold text-white">Projects and holes</div>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <ProjectAccordionList
                loading={loading}
                projects={filteredProjects}
                expandedProjects={expandedProjects}
                onToggleProject={toggleProjectExpanded}
                selectedHoleId={selectedHole?.id || ""}
                onSelectHole={focusHole}
              />
            </div>
          </aside>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_30px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(8,47,73,0.28),transparent)]" />
              <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Map canvas</div>
                  <div className="mt-1 text-lg font-semibold text-white">Hole collar positions</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalVisibleHoles} visible holes</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{projectFilter ? "Filtered project" : "Portfolio view"}</span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-3 top-20 z-10 xl:hidden">
                <div className="pointer-events-auto rounded-[26px] border border-white/10 bg-slate-950/72 p-2 backdrop-blur-xl shadow-[0_14px_40px_rgba(2,6,23,0.35)]">
                  <div className="inline-flex w-full items-center gap-2 rounded-2xl bg-white/[0.04] p-1.5">
                    <button
                      type="button"
                      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "projects" ? "bg-cyan-300 text-slate-950" : "text-slate-200"}`}
                      onClick={() => setMobilePanelTab("projects")}
                    >
                      Projects
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "hole" ? "bg-amber-300 text-slate-950" : "text-slate-200"}`}
                      onClick={() => setMobilePanelTab("hole")}
                    >
                      Hole
                    </button>
                  </div>
                </div>
              </div>
              <div ref={mapContainerRef} className="h-[54svh] min-h-[360px] w-full md:h-[58vh] md:min-h-[480px]" />
            </div>

            <div className="xl:hidden overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Navigator</div>
                    <div className="mt-1 text-lg font-semibold text-white">{mobilePanelTab === "projects" ? "Projects and holes" : "Hole attributes"}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                    {mobilePanelTab === "projects" ? `${totalVisibleProjects} projects` : selectedHole?.hole_id || "No selection"}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/45 p-1.5">
                    <button
                      type="button"
                      className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-400 text-slate-950 shadow-[0_12px_28px_rgba(251,191,36,0.28)]" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setProjectScope("own");
                        setProjectFilter("");
                      }}
                    >
                      My Projects
                    </button>
                    <button
                      type="button"
                      className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.25)]" : "text-slate-200 hover:bg-white/8"}`}
                      onClick={() => {
                        setProjectScope("shared");
                        setProjectFilter("");
                      }}
                    >
                      Client Shared
                    </button>
                  </div>

                  <label className="flex flex-col gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Project Filter
                    <select
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      className="h-12 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/40"
                    >
                      <option value="">All visible projects ({totalProjects})</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} ({project.holes.length})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {mobilePanelTab === "projects" ? (
                <ProjectAccordionList
                  loading={loading}
                  projects={filteredProjects}
                  expandedProjects={expandedProjects}
                  onToggleProject={toggleProjectExpanded}
                  selectedHoleId={selectedHole?.id || ""}
                  onSelectHole={focusHole}
                  compact
                />
              ) : (
                <HoleAttributesPanel selectedHole={selectedHole} mobile />
              )}
            </div>

            <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl xl:block">
              <div className="border-b border-white/10 px-4 py-4 md:px-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Selected Hole</div>
                    <div className="mt-1 text-lg font-semibold text-white">Attributes</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {selectedHole ? `Inspecting ${selectedHole.hole_id}` : "Click a hole on the map or in the project list."}
                  </div>
                </div>
              </div>

              <HoleAttributesPanel selectedHole={selectedHole} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
