"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

const MAP_SCOPE_STORAGE_KEY = "map-mobile:projectScope";
const HOLES_SOURCE_ID = "mobile-hole-map-source";
const HOLES_GLOW_LAYER_ID = "mobile-hole-map-glow";
const HOLES_CIRCLE_LAYER_ID = "mobile-hole-map-circles";
const HOLES_SELECTED_LAYER_ID = "mobile-hole-map-selected";
const DEFAULT_CENTER = [133.7751, -25.2744];
const DEFAULT_ZOOM = 3;
const MAPBOX_STYLE_URL = "mapbox://styles/jamesblue/cmmhkajfi000w01shgzr5c1op";
const SHEET_SNAP_OFFSETS = {
  full: 0,
  mid: 0.28,
  peek: 0.54,
};

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
        project_name: hole.project_name || "No project",
      },
    })),
  };
}

function MobileSheet({ open, title, subtitle, onClose, snap = "mid", onSnapChange, children }) {
  const dragStartYRef = useRef(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const snapOffsetPx = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const ratio = SHEET_SNAP_OFFSETS[snap] ?? SHEET_SNAP_OFFSETS.mid;
    return Math.round(window.innerHeight * ratio);
  }, [snap]);

  const currentOffset = open ? Math.max(0, snapOffsetPx + dragOffset) : 9999;

  const finishDrag = () => {
    if (!open) return;

    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
    const nextOffset = Math.max(0, snapOffsetPx + dragOffsetRef.current);
    const candidates = Object.entries(SHEET_SNAP_OFFSETS).map(([key, ratio]) => ({
      key,
      offset: viewportHeight * ratio,
    }));

    const nearest = candidates.reduce((best, item) => {
      return Math.abs(item.offset - nextOffset) < Math.abs(best.offset - nextOffset) ? item : best;
    }, candidates[0]);

    onSnapChange?.(nearest.key);
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setDragging(false);
  };

  const handleTouchStart = (event) => {
    if (!open) return;
    dragStartYRef.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
    setDragging(true);
  };

  const handleTouchMove = (event) => {
    if (dragStartYRef.current == null) return;
    const currentY = event.touches[0]?.clientY ?? dragStartYRef.current;
    const next = currentY - dragStartYRef.current;
    dragOffsetRef.current = next;
    setDragOffset(next);
  };

  const handleTouchEnd = () => {
    finishDrag();
  };

  return (
    <div
      className={`absolute inset-0 z-30 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-slate-950/58 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[34px] border-t border-white/10 bg-[linear-gradient(180deg,rgba(6,13,27,0.98),rgba(2,6,23,0.98))] shadow-[0_-24px_80px_rgba(2,6,23,0.55)]"
        style={{
          height: "78svh",
          maxHeight: "78svh",
          transform: `translateY(${currentOffset}px)`,
          transition: dragging ? "none" : "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div
          className="px-6 pt-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ touchAction: "none" }}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Workspace</div>
            <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSnapChange?.("peek")}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-100"
            >
              Peek
            </button>
            <button
              type="button"
              onClick={() => onSnapChange?.(snap === "full" ? "mid" : "full")}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-100"
            >
              {snap === "full" ? "Mid" : "Full"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100"
            >
              Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">{children}</div>
      </div>
    </div>
  );
}

function ProjectList({ projects, expandedProjects, onToggleProject, onSelectHole, selectedHoleId, loading }) {
  if (loading) {
    return (
      <div className="space-y-3 pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[28px] bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No visible projects with mappable hole coordinates.</div>;
  }

  return (
    <div className="space-y-3 pb-4">
      {projects.map((project) => {
        const isExpanded = expandedProjects[project.id] !== false;
        return (
          <div
            key={project.id}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.96))]"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              onClick={() => onToggleProject(project.id, isExpanded)}
            >
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-white">{project.name}</div>
                <div className="mt-1 text-xs text-slate-400">{project.holes.length} mapped hole{project.holes.length === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300">
                {isExpanded ? "Hide" : "Show"}
              </div>
            </button>
            {isExpanded ? (
              <div className="space-y-2 border-t border-white/10 px-3 py-3">
                {project.holes.map((hole) => {
                  const isSelected = hole.id === selectedHoleId;
                  return (
                    <button
                      key={hole.id}
                      type="button"
                      onClick={() => onSelectHole(hole)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-amber-300/50 bg-amber-300/12 shadow-[0_10px_32px_rgba(251,191,36,0.14)]" : "border-white/8 bg-white/[0.03]"}`}
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

function HoleDetailCards({ hole }) {
  return (
    <div className="space-y-3 pb-4">
      <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.68)_45%,rgba(120,53,15,0.42))] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.38)]">
        <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Selected Hole</div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">{hole?.hole_id || "No hole selected"}</div>
            <div className="mt-1 text-sm text-slate-300">{hole?.project_name || "Tap a point or choose a hole from the projects drawer"}</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
            {hole?.state || "-"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Depth", formatValue(hole?.depth, " m")],
          ["Planned", formatValue(hole?.planned_depth, " m")],
          ["Water", formatValue(hole?.water_level_m, " m")],
          ["Elevation", formatValue(hole?.collar_elevation_m, " m")],
          ["Azimuth", formatValue(hole?.azimuth, "°")],
          ["Dip", formatValue(hole?.dip, "°")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
            <div className="mt-2 text-base font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/55 p-4">
        {[
          ["Collar Source", hole?.collar_source || "-"],
          ["Longitude", formatValue(hole?.collar_longitude)],
          ["Latitude", formatValue(hole?.collar_latitude)],
          ["Started", formatDateTime(hole?.started_at)],
          ["Completed", formatDateTime(hole?.completed_at)],
          ["Completion Status", hole?.completion_status || "-"],
          ["Completion Notes", hole?.completion_notes || "-"],
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

export default function MobileHoleMapWorkspace({ publicToken = "", serverTokenPresent = false }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId } = useOrg();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxRef = useRef(null);
  const popupRef = useRef(null);
  const visibleHolesRef = useRef([]);
  const handlersBoundRef = useRef(false);
  const mapReadyRef = useRef(false);

  const [projectScope, setProjectScope] = useState("own");
  const [loading, setLoading] = useState(true);
  const [mapStatus, setMapStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [allHoles, setAllHoles] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [projectFilter, setProjectFilter] = useState("");
  const [holeSearch, setHoleSearch] = useState("");
  const [selectedHoleId, setSelectedHoleId] = useState("");
  const [activeSheet, setActiveSheet] = useState("");
  const [sheetSnap, setSheetSnap] = useState("mid");

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
          pitch: 34,
          bearing: -14,
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
        projectMap.set(key, { id: key, name: hole.project_name || "No project", holes: [] });
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
    const term = holeSearch.trim().toLowerCase();

    return projects
      .filter((project) => !projectFilter || project.id === projectFilter)
      .map((project) => {
        if (!term) return project;
        return {
          ...project,
          holes: project.holes.filter((hole) => {
            const idMatch = String(hole.hole_id || "").toLowerCase().includes(term);
            const projectMatch = String(project.name || "").toLowerCase().includes(term);
            return idMatch || projectMatch;
          }),
        };
      })
      .filter((project) => project.holes.length > 0);
  }, [holeSearch, projectFilter, projects]);

  const visibleHoles = useMemo(() => filteredProjects.flatMap((project) => project.holes), [filteredProjects]);

  useEffect(() => {
    visibleHolesRef.current = visibleHoles;
  }, [visibleHoles]);

  const selectedHole = useMemo(() => {
    return visibleHoles.find((hole) => hole.id === selectedHoleId) || visibleHoles[0] || null;
  }, [selectedHoleId, visibleHoles]);

  useEffect(() => {
    if (!activeSheet) return;
    setSheetSnap(activeSheet === "details" ? "full" : "mid");
  }, [activeSheet]);

  useEffect(() => {
    setExpandedProjects((prev) => {
      const next = { ...prev };
      filteredProjects.forEach((project) => {
        if (typeof next[project.id] === "undefined") next[project.id] = true;
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

  const renderPopupHtml = (hole) => {
    if (!hole) return "";
    return `
      <div style="min-width:170px;color:#0f172a;">
        <div style="font-weight:700;font-size:13px;letter-spacing:0.02em;">${hole.hole_id || "Unnamed hole"}</div>
        <div style="margin-top:6px;font-size:12px;line-height:1.5;">
          <div><strong>Project:</strong> ${hole.project_name || "No project"}</div>
          <div><strong>Depth:</strong> ${formatValue(hole.depth, " m")}</div>
          <div><strong>Azimuth:</strong> ${formatValue(hole.azimuth, "°")}</div>
        </div>
      </div>
    `;
  };

  const focusHole = (hole, options = {}) => {
    if (!hole) return;
    setSelectedHoleId(hole.id);

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) {
      setActiveSheet("details");
      return;
    }

    const lng = Number(hole.collar_longitude);
    const lat = Number(hole.collar_latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), speed: 0.8, curve: 1.2 });
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: false });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderPopupHtml(hole)).addTo(map);
    setActiveSheet("details");
  };

  const recenterSelectedHole = () => {
    if (selectedHole) {
      focusHole(selectedHole, { flyTo: true });
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    if (visibleHoles.length) {
      focusHole(visibleHoles[0], { flyTo: true });
    } else {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    }
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
          "circle-radius": 22,
          "circle-color": "#22d3ee",
          "circle-opacity": 0.16,
          "circle-blur": 0.95,
        },
      });
    }

    if (!map.getLayer(HOLES_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: HOLES_CIRCLE_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 8,
          "circle-color": "#fde047",
          "circle-stroke-color": "#082f49",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0.98,
        },
      });
    }

    if (!map.getLayer(HOLES_SELECTED_LAYER_ID)) {
      map.addLayer({
        id: HOLES_SELECTED_LAYER_ID,
        type: "circle",
        source: HOLES_SOURCE_ID,
        paint: {
          "circle-radius": 15,
          "circle-color": "rgba(249,115,22,0.22)",
          "circle-stroke-color": "#fb923c",
          "circle-stroke-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHole?.id || ""]);

    if (!handlersBoundRef.current) {
      map.on("mouseenter", HOLES_CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", HOLES_CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", HOLES_CIRCLE_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const hole = visibleHolesRef.current.find((row) => String(row.id) === String(feature.properties?.id));
        if (!hole) return;
        focusHole(hole, { flyTo: false });
      });
      handlersBoundRef.current = true;
    }

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

    const bounds = new mapboxgl.LngLatBounds();
    visibleHoles.forEach((hole) => {
      bounds.extend([Number(hole.collar_longitude), Number(hole.collar_latitude)]);
    });

    if (visibleHoles.length === 1) {
      map.flyTo({ center: [Number(visibleHoles[0].collar_longitude), Number(visibleHoles[0].collar_latitude)], zoom: 12 });
    } else {
      map.fitBounds(bounds, { padding: { top: 120, right: 60, bottom: 120, left: 60 }, maxZoom: 13, duration: 1100 });
    }
  }, [mapStatus, visibleHoles]);

  const toggleProjectExpanded = (projectId, isExpanded) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !isExpanded }));
  };

  const mobileHeight = "calc(100svh - 124px - env(safe-area-inset-bottom))";
  const totalVisibleProjects = filteredProjects.length;
  const totalVisibleHoles = visibleHoles.length;

  return (
    <div className="md:hidden overflow-hidden bg-[linear-gradient(180deg,#03101d_0%,#020617_100%)] px-0 pb-0 pt-0">
      <div className="relative overflow-hidden border-y border-white/10 bg-slate-950" style={{ height: mobileHeight }}>
        <div ref={mapContainerRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(2,6,23,0.48),transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.55),rgba(2,6,23,0.92))]" />

        <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/72 p-3 shadow-[0_16px_44px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Mobile Spatial View</div>
                <div className="mt-1 truncate text-lg font-semibold text-white">Drillhole Map</div>
                <div className="mt-1 text-xs text-slate-300">
                  {totalVisibleHoles} holes across {totalVisibleProjects} projects
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`badge ${serverTokenPresent ? "badge-green" : "badge-red"}`}>{serverTokenPresent ? "Token ready" : "Token missing"}</span>
                <span className={`badge ${mapStatus === "error" ? "badge-red" : mapStatus === "ready" ? "badge-green" : "badge-amber"}`}>
                  {mapStatus === "ready" ? "Map ready" : mapStatus === "error" ? "Map error" : "Loading"}
                </span>
              </div>
            </div>

            <div className="mt-3 inline-flex w-full items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${projectScope === "own" ? "bg-amber-300 text-slate-950" : "text-slate-100"}`}
                onClick={() => {
                  setProjectScope("own");
                  setProjectFilter("");
                }}
              >
                My Projects
              </button>
              <button
                type="button"
                className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${projectScope === "shared" ? "bg-cyan-300 text-slate-950" : "text-slate-100"}`}
                onClick={() => {
                  setProjectScope("shared");
                  setProjectFilter("");
                }}
              >
                Client Shared
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-3 right-3 z-20 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 rounded-[28px] border border-white/10 bg-slate-950/76 p-3 shadow-[0_16px_44px_rgba(2,6,23,0.38)] backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Selected</div>
            <div className="mt-1 truncate text-base font-semibold text-white">{selectedHole?.hole_id || "No hole selected"}</div>
            <div className="mt-1 truncate text-xs text-slate-300">{selectedHole?.project_name || "Choose a hole from the map or projects drawer"}</div>
            {selectedHole ? (
              <button
                type="button"
                onClick={() => setActiveSheet("details")}
                className="mt-3 inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white"
              >
                View details
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-3">
            <button
              type="button"
              onClick={recenterSelectedHole}
              className="inline-flex min-h-[64px] min-w-[88px] flex-col items-center justify-center rounded-[24px] border border-white/20 bg-white/12 px-4 py-3 text-slate-50 shadow-[0_16px_36px_rgba(15,23,42,0.24)] backdrop-blur-xl"
            >
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-200/80">Focus</span>
              <span className="mt-1 text-sm font-semibold">Recenter</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSheet("filters")}
              className="inline-flex min-h-[64px] min-w-[88px] flex-col items-center justify-center rounded-[24px] border border-cyan-300/20 bg-cyan-300/14 px-4 py-3 text-slate-50 shadow-[0_16px_36px_rgba(34,211,238,0.18)] backdrop-blur-xl"
            >
              <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/80">Tune</span>
              <span className="mt-1 text-sm font-semibold">Filters</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSheet("projects")}
              className="inline-flex min-h-[72px] min-w-[88px] flex-col items-center justify-center rounded-[24px] border border-amber-300/20 bg-amber-300/14 px-4 py-3 text-slate-50 shadow-[0_16px_36px_rgba(251,191,36,0.18)] backdrop-blur-xl"
            >
              <span className="text-[11px] uppercase tracking-[0.18em] text-amber-100/80">Browse</span>
              <span className="mt-1 text-sm font-semibold">Projects</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="absolute left-3 right-3 top-[164px] z-20 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 backdrop-blur-xl">
            {error}
          </div>
        ) : null}

        <MobileSheet
          open={activeSheet === "filters"}
          title="Filters"
          subtitle="Change scope and narrow the visible projects without leaving the map."
          onClose={() => setActiveSheet("")}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
        >
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Visible Projects</div>
                <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleProjects}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Mapped Holes</div>
                <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleHoles}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Project Filter</div>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 text-sm text-slate-100 outline-none"
              >
                <option value="">All visible projects ({projects.length})</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.holes.length})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Hole Search</div>
              <input
                type="text"
                value={holeSearch}
                onChange={(event) => setHoleSearch(event.target.value)}
                placeholder="Search by hole ID or project"
                className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="mt-2 text-xs text-slate-400">
                Showing {totalVisibleHoles} hole{totalVisibleHoles === 1 ? "" : "s"} after filters.
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              This mobile workspace never shows data outside your organization or explicitly shared client projects.
            </div>
          </div>
        </MobileSheet>

        <MobileSheet
          open={activeSheet === "projects"}
          title="Projects and holes"
          subtitle="Expand a project, pick a hole, and the map will jump straight to it."
          onClose={() => setActiveSheet("")}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
        >
          <ProjectList
            projects={filteredProjects}
            expandedProjects={expandedProjects}
            onToggleProject={toggleProjectExpanded}
            onSelectHole={focusHole}
            selectedHoleId={selectedHole?.id || ""}
            loading={loading}
          />
        </MobileSheet>

        <MobileSheet
          open={activeSheet === "details"}
          title="Hole attributes"
          subtitle={selectedHole ? `Inspecting ${selectedHole.hole_id}` : "No hole selected yet."}
          onClose={() => setActiveSheet("")}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
        >
          <HoleDetailCards hole={selectedHole} />
        </MobileSheet>
      </div>
    </div>
  );
}
