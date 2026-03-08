"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = [133.7751, -25.2744]; // Australia
const DEFAULT_ZOOM = 3;

export default function MapTestPage() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState("initializing");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      setStatus("error");
      setError("Missing NEXT_PUBLIC_MAPBOX_TOKEN in environment.");
      return;
    }

    let disposed = false;

    const init = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;

        if (disposed || !mapContainerRef.current) return;

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (disposed) return;
          new mapboxgl.Marker({ color: "#4f46e5" }).setLngLat(DEFAULT_CENTER).addTo(map);
          setStatus("ready");
        });

        map.on("error", (evt) => {
          const message = evt?.error?.message || "Mapbox runtime error.";
          if (disposed) return;
          setStatus("error");
          setError(message);
        });
      } catch (e) {
        if (disposed) return;
        setStatus("error");
        setError(e?.message || "Failed to initialize Mapbox.");
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
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="max-w-5xl mx-auto space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-100">Mapbox Test</h1>
        <p className="text-sm text-slate-400">
          Isolated smoke test for token and Mapbox rendering. This page does not load hole data yet.
        </p>

        <div className="text-xs">
          {status === "ready" ? (
            <span className="badge badge-green">Map loaded</span>
          ) : status === "error" ? (
            <span className="badge badge-red">Map error</span>
          ) : (
            <span className="badge badge-amber">Initializing map...</span>
          )}
        </div>

        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="card p-2 md:p-3">
          <div ref={mapContainerRef} className="h-[70vh] min-h-[460px] w-full rounded-xl border border-white/10" />
        </div>
      </div>
    </div>
  );
}
