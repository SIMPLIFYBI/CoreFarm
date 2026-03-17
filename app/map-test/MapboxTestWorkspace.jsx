"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CENTER = [133.7751, -25.2744];
const DEFAULT_ZOOM = 3;
const CUSTOM_STYLE_URL = "mapbox://styles/jamesblue/cmmhkajfi000w01shgzr5c1op";
const STANDARD_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const SAMPLE_HOLE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [115.8605, -31.9505] },
      properties: { id: "hole-1", label: "Sample Hole" },
    },
  ],
};
const SAMPLE_ASSET = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [151.2093, -33.8688] },
      properties: { id: "asset-1", label: "Sample Asset" },
    },
  ],
};

const PRESETS = {
  standard_basic: {
    label: "1. Standard style only",
    description: "Tests the simplest possible Mapbox map with a standard Mapbox-hosted style.",
    style: STANDARD_STYLE_URL,
    addHoleLayer: false,
    addAssetLayer: false,
  },
  custom_basic: {
    label: "2. Custom style only",
    description: "Tests your custom style with no app layers added.",
    style: CUSTOM_STYLE_URL,
    addHoleLayer: false,
    addAssetLayer: false,
  },
  custom_hole: {
    label: "3. Custom style + one hole",
    description: "Tests your custom style plus one simple GeoJSON hole layer.",
    style: CUSTOM_STYLE_URL,
    addHoleLayer: true,
    addAssetLayer: false,
  },
  custom_hole_asset: {
    label: "4. Custom style + hole and asset",
    description: "Tests your custom style plus one simple hole layer and one simple asset layer.",
    style: CUSTOM_STYLE_URL,
    addHoleLayer: true,
    addAssetLayer: true,
  },
};

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function compactEventError(evt) {
  return [evt?.error?.message, evt?.message, evt?.sourceId, evt?.tile?.tileID?.canonical ? `tile ${evt.tile.tileID.canonical.z}/${evt.tile.tileID.canonical.x}/${evt.tile.tileID.canonical.y}` : ""]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ") || "Mapbox runtime error.";
}

export default function MapboxTestWorkspace({ publicToken = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [presetKey, setPresetKey] = useState("standard_basic");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const preset = useMemo(() => PRESETS[presetKey], [presetKey]);

  const pushLog = (message) => {
    setLogs((prev) => [`${nowLabel()}  ${message}`, ...prev].slice(0, 30));
  };

  useEffect(() => {
    const token = String(publicToken || "").trim();
    if (!token) {
      setStatus("error");
      setError("Missing NEXT_PUBLIC_MAPBOX_TOKEN in environment.");
      setLogs([]);
      return undefined;
    }

    let disposed = false;
    let mapInstance = null;

    const init = async () => {
      setStatus("loading");
      setError("");
      setLogs([]);
      pushLog(`Starting preset: ${preset.label}`);

      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (disposed || !containerRef.current) return;

        mapboxgl.accessToken = token;
        mapInstance = new mapboxgl.Map({
          container: containerRef.current,
          style: preset.style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        });
        mapRef.current = mapInstance;
        mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");

        mapInstance.on("load", () => {
          if (disposed || !mapInstance) return;
          pushLog("Map load event fired.");

          if (preset.addHoleLayer) {
            pushLog("Adding sample hole source/layer.");
            mapInstance.addSource("map-test-hole-source", { type: "geojson", data: SAMPLE_HOLE });
            mapInstance.addLayer({
              id: "map-test-hole-layer",
              type: "circle",
              source: "map-test-hole-source",
              paint: {
                "circle-radius": 8,
                "circle-color": "#f59e0b",
                "circle-stroke-color": "#111827",
                "circle-stroke-width": 2,
              },
            });
          }

          if (preset.addAssetLayer) {
            pushLog("Adding sample asset source/layer.");
            mapInstance.addSource("map-test-asset-source", { type: "geojson", data: SAMPLE_ASSET });
            mapInstance.addLayer({
              id: "map-test-asset-layer",
              type: "circle",
              source: "map-test-asset-source",
              paint: {
                "circle-radius": 7,
                "circle-color": "#ec4899",
                "circle-stroke-color": "#fdf2f8",
                "circle-stroke-width": 2,
              },
            });
          }

          setStatus("ready");
        });

        mapInstance.on("styledata", () => {
          if (disposed) return;
          pushLog("Style data event fired.");
        });

        mapInstance.on("idle", () => {
          if (disposed) return;
          pushLog("Map idle event fired.");
        });

        mapInstance.on("error", (evt) => {
          if (disposed) return;
          const message = compactEventError(evt);
          pushLog(`Error: ${message}`);
          setStatus("error");
          setError(message);
        });
      } catch (evt) {
        if (disposed) return;
        const message = evt?.message || "Failed to initialize Mapbox test page.";
        pushLog(`Init failure: ${message}`);
        setStatus("error");
        setError(message);
      }
    };

    void init();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [preset, publicToken]);

  return (
    <div className="min-h-screen bg-transparent px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Map Test</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Minimal Mapbox debug page</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            This page strips the map back to controlled presets so we can see whether the failure starts with basic Mapbox init,
            your custom style, or only after simple GeoJSON layers are added.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/50 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Preset</div>
              <div className="mt-3 space-y-2">
                {Object.entries(PRESETS).map(([key, value]) => {
                  const active = key === presetKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPresetKey(key)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? "border-cyan-300/40 bg-cyan-300/12 text-white" : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"}`}
                    >
                      <div className="text-sm font-semibold">{value.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{value.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">State</div>
              <div className="mt-2 text-sm text-white">{status}</div>
              {error ? <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-300">
              <div className="font-semibold text-slate-100">How to use</div>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Start with the standard style preset.</li>
                <li>Move to the custom style preset.</li>
                <li>Then add the sample hole and asset layers.</li>
              </ol>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/50 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
              <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">{preset.label}</div>
              <div ref={containerRef} className="h-[60vh] min-h-[420px] w-full" />
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/50 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
              <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">Event log</div>
              <div className="max-h-[320px] overflow-y-auto p-4 font-mono text-xs leading-6 text-slate-300">
                {logs.length ? (
                  logs.map((entry, index) => (
                    <div key={`${entry}-${index}`}>{entry}</div>
                  ))
                ) : (
                  <div className="text-slate-500">No events yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
