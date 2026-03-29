"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";

const DEFAULT_CENTER = [134.5, -25.5];
const DEFAULT_ZOOM = 3.4;
const HOLES_SOURCE_ID = "core-workbench-org-holes";
const HOLES_PROJECT_LAYER_ID = "core-workbench-project-holes";
const HOLES_ORG_LAYER_ID = "core-workbench-org-hole-context";
const PICKED_SOURCE_ID = "core-workbench-picked-hole-location";
const PICKED_FILL_LAYER_ID = "core-workbench-picked-hole-fill";
const PICKED_RING_LAYER_ID = "core-workbench-picked-hole-ring";

function roundCoordinate(value, decimals = 6) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Number(numberValue.toFixed(decimals));
}

function formatCoordinate(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return numberValue.toFixed(6);
}

function buildHoleCollection(rows, selectedProjectId) {
  return {
    type: "FeatureCollection",
    features: rows.map((hole) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [hole.collar_longitude, hole.collar_latitude],
      },
      properties: {
        id: hole.id,
        hole_id: hole.hole_id || "Unnamed hole",
        project_name: hole.project_name || "No project",
        state: hole.state || "",
        is_project_hole: hole.project_id === selectedProjectId ? 1 : 0,
      },
    })),
  };
}

function buildPickedCollection(point) {
  return {
    type: "FeatureCollection",
    features: point
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [point.longitude, point.latitude],
            },
            properties: {},
          },
        ]
      : [],
  };
}

function calculateBounds(mapboxgl, holes, pickedPoint) {
  const coordinates = holes.map((hole) => [hole.collar_longitude, hole.collar_latitude]);
  if (pickedPoint) {
    coordinates.push([pickedPoint.longitude, pickedPoint.latitude]);
  }

  if (!coordinates.length) return null;

  const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
  coordinates.slice(1).forEach((coordinate) => bounds.extend(coordinate));
  return bounds;
}

export default function HoleLocationPickerModal({
  project,
  initialLongitude = "",
  initialLatitude = "",
  onClose,
  onConfirm,
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId } = useOrg();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxRef = useRef(null);
  const didInitialFitRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [holes, setHoles] = useState([]);
  const [pickedPoint, setPickedPoint] = useState(() => {
    const longitude = roundCoordinate(initialLongitude);
    const latitude = roundCoordinate(initialLatitude);
    if (longitude == null || latitude == null) return null;
    return { longitude, latitude };
  });

  const publicToken = String(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();

  const projectHoleCount = useMemo(() => holes.filter((hole) => hole.project_id === project?.id).length, [holes, project?.id]);

  useEffect(() => {
    const longitude = roundCoordinate(initialLongitude);
    const latitude = roundCoordinate(initialLatitude);
    if (longitude == null || latitude == null) {
      setPickedPoint(null);
      return;
    }
    setPickedPoint({ longitude, latitude });
  }, [initialLatitude, initialLongitude]);

  useEffect(() => {
    let active = true;

    if (!orgId) {
      setHoles([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    (async () => {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("holes")
        .select("id,hole_id,project_id,state,collar_longitude,collar_latitude,collar_easting,collar_northing,projects(name,coordinate_crs_code)")
        .eq("organization_id", orgId)
        .order("project_id", { ascending: true })
        .order("hole_id", { ascending: true });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load hole map context");
        setHoles([]);
        setLoading(false);
        return;
      }

      const mappedHoles = (data || [])
        .map((hole) => {
          const derived = deriveHoleCoordinates({
            collarLongitude: hole.collar_longitude ?? null,
            collarLatitude: hole.collar_latitude ?? null,
            collarEasting: hole.collar_easting ?? null,
            collarNorthing: hole.collar_northing ?? null,
            projectCrsCode: hole.projects?.coordinate_crs_code ?? null,
          });

          return {
            id: hole.id,
            hole_id: hole.hole_id,
            project_id: hole.project_id || "",
            project_name: hole.projects?.name || "No project",
            state: hole.state || "",
            collar_longitude: derived.collarLongitude,
            collar_latitude: derived.collarLatitude,
          };
        })
        .filter((hole) => hole.collar_longitude != null && hole.collar_latitude != null);

      setHoles(mappedHoles);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [orgId, supabase]);

  useEffect(() => {
    if (!publicToken) {
      setError("Missing NEXT_PUBLIC_MAPBOX_TOKEN in environment.");
      return undefined;
    }

    if (!mapContainerRef.current) return undefined;

    let disposed = false;

    const initMap = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (disposed || !mapContainerRef.current) return;

        mapboxgl.accessToken = publicToken;
        mapboxRef.current = mapboxgl;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          pitch: 0,
          attributionControl: false,
        });

        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        map.on("load", () => {
          if (disposed) return;

          map.addSource(HOLES_SOURCE_ID, {
            type: "geojson",
            data: buildHoleCollection([], project?.id || ""),
          });

          map.addLayer({
            id: HOLES_ORG_LAYER_ID,
            type: "circle",
            source: HOLES_SOURCE_ID,
            filter: ["==", ["get", "is_project_hole"], 0],
            paint: {
              "circle-radius": 5,
              "circle-color": "#64748b",
              "circle-opacity": 0.45,
              "circle-stroke-width": 1,
              "circle-stroke-color": "rgba(255,255,255,0.22)",
            },
          });

          map.addLayer({
            id: HOLES_PROJECT_LAYER_ID,
            type: "circle",
            source: HOLES_SOURCE_ID,
            filter: ["==", ["get", "is_project_hole"], 1],
            paint: {
              "circle-radius": 6,
              "circle-color": "#22d3ee",
              "circle-opacity": 0.9,
              "circle-stroke-width": 2,
              "circle-stroke-color": "rgba(255,255,255,0.55)",
            },
          });

          map.addSource(PICKED_SOURCE_ID, {
            type: "geojson",
            data: buildPickedCollection(pickedPoint),
          });

          map.addLayer({
            id: PICKED_FILL_LAYER_ID,
            type: "circle",
            source: PICKED_SOURCE_ID,
            paint: {
              "circle-radius": 8,
              "circle-color": "#f97316",
              "circle-opacity": 0.95,
            },
          });

          map.addLayer({
            id: PICKED_RING_LAYER_ID,
            type: "circle",
            source: PICKED_SOURCE_ID,
            paint: {
              "circle-radius": 14,
              "circle-color": "rgba(249,115,22,0.12)",
              "circle-stroke-width": 2,
              "circle-stroke-color": "rgba(253,186,116,0.85)",
            },
          });

          map.on("click", (event) => {
            const nextPoint = {
              longitude: roundCoordinate(event.lngLat.lng),
              latitude: roundCoordinate(event.lngLat.lat),
            };

            setPickedPoint(nextPoint);
            map.easeTo({ center: [nextPoint.longitude, nextPoint.latitude], zoom: Math.max(map.getZoom(), 12.5), duration: 500 });
          });

          setMapReady(true);
          setError("");
        });
      } catch (mapError) {
        if (disposed) return;
        setError(mapError?.message || "Failed to initialize map picker");
      }
    };

    void initMap();

    return () => {
      disposed = true;
      setMapReady(false);
      didInitialFitRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [project?.id, publicToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const holesSource = map.getSource(HOLES_SOURCE_ID);
    if (holesSource) {
      holesSource.setData(buildHoleCollection(holes, project?.id || ""));
    }

    const pickedSource = map.getSource(PICKED_SOURCE_ID);
    if (pickedSource) {
      pickedSource.setData(buildPickedCollection(pickedPoint));
    }

    if (didInitialFitRef.current) return;

    const mapboxgl = mapboxRef.current;
    if (!mapboxgl) return;

    const focusHoles = holes.filter((hole) => hole.project_id === project?.id);
    const bounds = calculateBounds(mapboxgl, focusHoles.length ? focusHoles : holes, pickedPoint);
    if (bounds) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 0 });
      didInitialFitRef.current = true;
      return;
    }

    if (pickedPoint) {
      map.jumpTo({ center: [pickedPoint.longitude, pickedPoint.latitude], zoom: 12.5 });
      didInitialFitRef.current = true;
    }
  }, [holes, mapReady, pickedPoint, project?.id]);

  return (
    <div className="fixed inset-0 z-[70] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.1),transparent_28%),rgba(2,6,23,0.78)] p-3 md:p-6">
      <div className="flex h-full items-center justify-center">
        <div className="glass flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[34px] border border-white/15 bg-slate-950/92 shadow-[0_35px_120px_rgba(2,6,23,0.72)]">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.55),rgba(15,23,42,0.92)_42%,rgba(234,88,12,0.22))] px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">Hole location picker</div>
              <h3 className="mt-1 text-xl font-semibold text-white">Find collar on map</h3>
              <p className="mt-1 text-sm text-slate-300">
                Choose a point for the new hole in {project?.name || "the selected project"}. Existing org holes stay visible for context.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
                {projectHoleCount} project hole{projectHoleCount === 1 ? "" : "s"} visible
              </div>
              <button type="button" className="btn btn-3d-glass" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.85fr)]">
            <aside className="order-2 flex min-h-0 flex-col border-t border-white/10 bg-slate-950/45 p-4 lg:order-1 lg:border-r lg:border-t-0 lg:p-5">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">How it works</div>
                <div className="mt-2 text-sm text-slate-200">Select a project first, click a point on the map, then confirm the collar location.</div>
                <div className="mt-3 text-xs text-slate-400">The first version writes WGS84 longitude and latitude back to the form. Projected coordinates remain optional.</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Org holes</div>
                  <div className="mt-1 text-lg font-semibold text-white">{holes.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Working CRS</div>
                  <div className="mt-1 text-sm font-medium text-white">{project?.coordinate_crs_code || "WGS84 only"}</div>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-orange-300/20 bg-orange-400/8 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-orange-100/70">Picked point</div>
                {pickedPoint ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Longitude</span>
                      <span className="font-medium text-white">{formatCoordinate(pickedPoint.longitude)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Latitude</span>
                      <span className="font-medium text-white">{formatCoordinate(pickedPoint.latitude)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-300">No point selected yet. Click anywhere on the map to place the collar.</div>
                )}
              </div>

              {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">{error}</div> : null}
              {loading ? <div className="mt-4 text-sm text-slate-400">Loading hole context...</div> : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                <button type="button" className="btn btn-3d-glass" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-3d-primary"
                  onClick={() => pickedPoint && onConfirm(pickedPoint)}
                  disabled={!pickedPoint}
                >
                  Use this location
                </button>
              </div>
            </aside>

            <section className="order-1 min-h-[320px] bg-slate-950 lg:order-2">
              <div ref={mapContainerRef} className="h-full min-h-[320px] w-full" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}