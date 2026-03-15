"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import DepthAxisBar from "@/app/drillhole-viz/components/DepthAxisBar";
import BoreholeSchematicPreview from "@/app/drillhole-viz/components/BoreholeSchematicPreview";
import { convertProjectedToWgs84 } from "@/lib/coordinateTransforms";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";

const MAP_SCOPE_STORAGE_KEY = "map:projectScope";
const HOLES_SOURCE_ID = "prod-hole-map-source";
const HOLES_GLOW_LAYER_ID = "prod-hole-map-glow";
const HOLES_CIRCLE_LAYER_ID = "prod-hole-map-circles";
const HOLES_SELECTED_LAYER_ID = "prod-hole-map-selected";
const HOLES_LABEL_LAYER_ID = "prod-hole-map-labels";
const ASSETS_SOURCE_ID = "prod-asset-map-source";
const ASSETS_GLOW_LAYER_ID = "prod-asset-map-glow";
const ASSETS_CIRCLE_LAYER_ID = "prod-asset-map-circles";
const ASSETS_SELECTED_LAYER_ID = "prod-asset-map-selected";
const DEFAULT_CENTER = [133.7751, -25.2744];
const DEFAULT_ZOOM = 3;
const MAPBOX_STYLE_URL = "mapbox://styles/jamesblue/cmmhkajfi000w01shgzr5c1op";
const MAP_REFOCUS_SPEED = 0.38;
const MAP_REFOCUS_CURVE = 1.5;
const MAP_PROJECT_FRAME_DURATION = 2800;
const HOLE_STATE_STYLES = [
  { value: "proposed", label: "Proposed", color: "#38bdf8" },
  { value: "in_progress", label: "In Progress", color: "#f59e0b" },
  { value: "drilled", label: "Drilled", color: "#22c55e" },
];

const ASSET_COLOR = "#f472b6";
const ASSET_STATUS_STYLES = [{ value: "assets", label: "Assets", color: ASSET_COLOR }];

const HOLE_STATE_COLOR_EXPRESSION = [
  "match",
  ["get", "state"],
  "drilled",
  "#22c55e",
  "in_progress",
  "#f59e0b",
  "#38bdf8",
];

function cinematicEase(t) {
  return 1 - Math.pow(1 - t, 3);
}

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

function HoleStateLegend() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/72 px-2.5 py-2 shadow-[0_14px_40px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div className="space-y-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {HOLE_STATE_STYLES.map((item) => (
              <div key={item.value} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200">
                <span className="h-2 w-2 rounded-full ring-2 ring-slate-950/70" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Assets</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {ASSET_STATUS_STYLES.map((item) => (
              <div key={item.value} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200">
                <span className="h-2 w-2 rounded-full ring-2 ring-slate-950/70" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyProjectPrompt({ compact = false }) {
  return (
    <div
      className={compact ? "p-4" : "p-5"}
    >
      <div className="rounded-[28px] border border-dashed border-cyan-300/25 bg-[linear-gradient(180deg,rgba(8,47,73,0.32),rgba(2,6,23,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
        <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Get Started</div>
        <h3 className="mt-3 text-xl font-semibold text-white">No projects yet</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
          Create your first project to start mapping drillholes, viewing collar positions, and navigating between hole programs.
        </p>
        <Link
          href="/projects?tab=projects"
          className="mt-5 inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#38bdf8)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.24)] transition hover:brightness-105"
        >
          Create A Project
        </Link>
      </div>
    </div>
  );
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

function makeHoleFeatureCollection(rows) {
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

function makeAssetFeatureCollection(rows) {
  return {
    type: "FeatureCollection",
    features: rows.map((asset) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(asset.longitude), Number(asset.latitude)],
      },
      properties: {
        id: asset.id,
        name: asset.name || "Unnamed asset",
        project_id: asset.project_id || "",
        project_name: asset.project_name || "No project",
        status: asset.status || "",
        asset_type_name: asset.asset_type_name || "-",
        location_name: asset.location_name || "-",
        coordinate_source: asset.coordinate_source || "",
      },
    })),
  };
}

function deriveMapAssetCoordinates(asset) {
  const longitude = asset?.longitude ?? null;
  const latitude = asset?.latitude ?? null;
  if (longitude != null && latitude != null) {
    return { longitude, latitude, coordinateDerived: false };
  }

  if (asset?.easting == null || asset?.northing == null || !asset?.project_crs_code) {
    return { longitude, latitude, coordinateDerived: false };
  }

  try {
    const converted = convertProjectedToWgs84({
      crsCode: asset.project_crs_code,
      easting: asset.easting,
      northing: asset.northing,
    });

    return {
      longitude: converted.longitude,
      latitude: converted.latitude,
      coordinateDerived: true,
    };
  } catch {
    return { longitude, latitude, coordinateDerived: false };
  }
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
    return <EmptyProjectPrompt compact={compact} />;
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

function AssetAccordionList({
  loading,
  projects,
  expandedProjects,
  onToggleProject,
  selectedAssetId,
  onSelectAsset,
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
    return (
      <div className={compact ? "p-4" : "p-5"}>
        <div className="rounded-[28px] border border-dashed border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(2,6,23,0.88))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.24)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">Mapped Assets</div>
          <h3 className="mt-3 text-xl font-semibold text-white">No assets with map coordinates</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Add longitude and latitude, or save projected easting and northing against a project CRS, to show assets on the map.
          </p>
        </div>
      </div>
    );
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
                <div className="mt-1 text-xs text-slate-400">{project.assets.length} mapped asset{project.assets.length === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                {isExpanded ? "Hide" : "Show"}
              </div>
            </button>

            {isExpanded ? (
              <div className="space-y-2 border-t border-white/10 px-3 py-3">
                {project.assets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onSelectAsset(asset)}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? "border-rose-300/50 bg-rose-300/12 shadow-[0_10px_32px_rgba(244,114,182,0.16)]" : "border-white/8 bg-white/[0.03] hover:border-rose-300/30 hover:bg-rose-300/[0.06]"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{asset.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {asset.asset_type_name || "Unknown type"} · {asset.location_name || "No location"}
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
                        {asset.status || "-"}
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
            ["Easting", formatValue(selectedHole?.collar_easting)],
            ["Northing", formatValue(selectedHole?.collar_northing)],
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
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Easting</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_easting)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Northing</th>
            <td className="px-4 py-3">{formatValue(selectedHole?.collar_northing)}</td>
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

function AssetAttributesPanel({ selectedAsset, mobile = false }) {
  if (mobile) {
    return (
      <div className="space-y-3 p-4">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,47,73,0.68)_45%,rgba(8,145,178,0.28))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Selected Asset</div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-white">{selectedAsset?.name || "No asset selected"}</div>
              <div className="mt-1 text-sm text-slate-300">{selectedAsset?.project_name || "Tap an asset marker or list item to inspect detail"}</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
              {selectedAsset?.status || "-"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Type", selectedAsset?.asset_type_name || "-"],
            ["Location", selectedAsset?.location_name || "-"],
            ["Easting", formatValue(selectedAsset?.easting)],
            ["Northing", formatValue(selectedAsset?.northing)],
            ["Longitude", formatValue(selectedAsset?.longitude)],
            ["Latitude", formatValue(selectedAsset?.latitude)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              <div className="mt-2 text-base font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/55 p-4">
          {[
            ["Project", selectedAsset?.project_name || "-"],
            ["Coordinate Source", selectedAsset?.coordinate_source || "-"],
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
            <td className="px-4 py-3">{selectedAsset?.project_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Asset</th>
            <td className="px-4 py-3">{selectedAsset?.name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Status</th>
            <td className="px-4 py-3">{selectedAsset?.status || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Type</th>
            <td className="px-4 py-3">{selectedAsset?.asset_type_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Location</th>
            <td className="px-4 py-3">{selectedAsset?.location_name || "-"}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Longitude</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.longitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Latitude</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.latitude)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Easting</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.easting)}</td>
          </tr>
          <tr className="border-b border-white/10">
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Northing</th>
            <td className="px-4 py-3">{formatValue(selectedAsset?.northing)}</td>
          </tr>
          <tr>
            <th className="bg-white/[0.03] px-4 py-3 text-left font-medium text-slate-300">Coordinate Source</th>
            <td className="px-4 py-3">{selectedAsset?.coordinate_source || "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function HoleSchematicModal({
  hole,
  loading,
  error,
  geologyRows,
  constructionRows,
  annulusRows,
  lithById,
  constructionById,
  annulusById,
  onClose,
}) {
  useEffect(() => {
    if (!hole) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hole, onClose]);

  if (!hole) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/78 backdrop-blur-md" onClick={onClose}>
      <div className="flex h-full w-full items-center justify-center p-3 md:p-6">
        <div
          className="flex h-[min(92vh,980px)] w-full max-w-[1500px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-[0_30px_120px_rgba(2,6,23,0.5)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hole-schematic-title"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Hole Schematic</div>
              <div id="hole-schematic-title" className="mt-2 text-2xl font-semibold text-white">
                {hole.hole_id || "Unnamed hole"}
              </div>
              <div className="mt-1 text-sm text-slate-300">{hole.project_name || "No project"}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
            >
              Back To Map
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 md:p-5">
            {loading ? (
              <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)]">
                <div className="h-[620px] animate-pulse rounded-3xl bg-white/[0.05]" />
                <div className="h-[620px] animate-pulse rounded-3xl bg-white/[0.05]" />
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">{error}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Depth</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.depth, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Planned</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.planned_depth, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Water</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatValue(hole.water_level_m, " m")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Status</div>
                    <div className="mt-2 text-lg font-semibold text-white">{hole.state || "-"}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-slate-950/40 p-3 md:p-5">
                  <div className="inline-flex min-w-max items-start gap-3">
                    <DepthAxisBar plannedDepth={hole.planned_depth} actualDepth={hole.depth} waterLevel={hole.water_level_m} />

                    <BoreholeSchematicPreview
                      plannedDepth={hole.planned_depth}
                      actualDepth={hole.depth}
                      waterLevel={hole.water_level_m}
                      geologyIntervals={geologyRows}
                      lithById={lithById}
                      annulusIntervals={annulusRows}
                      annulusById={annulusById}
                      constructionIntervals={constructionRows}
                      constructionById={constructionById}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
  const visibleAssetsRef = useRef([]);
  const schematicRequestRef = useRef(0);

  const [projectScope, setProjectScope] = useState("own");
  const [loading, setLoading] = useState(true);
  const [mapStatus, setMapStatus] = useState("initializing");
  const [error, setError] = useState("");
  const [allHoles, setAllHoles] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [navigatorTab, setNavigatorTab] = useState("holes");
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedAssetProjects, setExpandedAssetProjects] = useState({});
  const [selectedHoleId, setSelectedHoleId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [mobilePanelTab, setMobilePanelTab] = useState("projects");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [schematicHole, setSchematicHole] = useState(null);
  const [schematicLoading, setSchematicLoading] = useState(false);
  const [schematicError, setSchematicError] = useState("");
  const [schematicGeologyRows, setSchematicGeologyRows] = useState([]);
  const [schematicConstructionRows, setSchematicConstructionRows] = useState([]);
  const [schematicAnnulusRows, setSchematicAnnulusRows] = useState([]);
  const [schematicLithologyTypes, setSchematicLithologyTypes] = useState([]);
  const [schematicConstructionTypes, setSchematicConstructionTypes] = useState([]);
  const [schematicAnnulusTypes, setSchematicAnnulusTypes] = useState([]);

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
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const syncViewport = (event) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

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
        let holeRows = [];
        let assetRows = [];

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
            const [holesRes, assetsRes] = await Promise.all([
              supabase
                .from("holes")
                .select(
                  "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,projects(id,name,coordinate_crs_code,coordinate_crs_name)"
                )
                .in("project_id", sharedProjectIds)
                .neq("organization_id", orgId)
                .order("project_id", { ascending: true })
                .order("hole_id", { ascending: true }),
              supabase
                .from("assets")
                .select(
                  "id,organization_id,name,project_id,status,easting,northing,longitude,latitude,coordinate_source,asset_types(name),asset_locations(name),projects(id,name,coordinate_crs_code,coordinate_crs_name)"
                )
                .in("project_id", sharedProjectIds)
                .neq("organization_id", orgId)
                .order("project_id", { ascending: true })
                .order("name", { ascending: true }),
            ]);

            if (holesRes.error) throw holesRes.error;
            if (assetsRes.error) throw assetsRes.error;
            holeRows = holesRes.data || [];
            assetRows = assetsRes.data || [];
          }
        } else {
          const [holesRes, assetsRes] = await Promise.all([
            supabase
              .from("holes")
              .select(
                "id,organization_id,hole_id,project_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,state,projects(id,name,coordinate_crs_code,coordinate_crs_name)"
              )
              .eq("organization_id", orgId)
              .order("project_id", { ascending: true })
              .order("hole_id", { ascending: true }),
            supabase
              .from("assets")
              .select(
                "id,organization_id,name,project_id,status,easting,northing,longitude,latitude,coordinate_source,asset_types(name),asset_locations(name),projects(id,name,coordinate_crs_code,coordinate_crs_name)"
              )
              .eq("organization_id", orgId)
              .order("project_id", { ascending: true })
              .order("name", { ascending: true }),
          ]);

          if (holesRes.error) throw holesRes.error;
          if (assetsRes.error) throw assetsRes.error;
          holeRows = holesRes.data || [];
          assetRows = assetsRes.data || [];
        }

        if (!active) return;

        setAllHoles(
          holeRows
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
                collar_longitude: derived.collarLongitude,
                collar_latitude: derived.collarLatitude,
                collar_easting: hole.collar_easting ?? null,
                collar_northing: hole.collar_northing ?? null,
                collar_elevation_m: hole.collar_elevation_m ?? null,
                collar_source: hole.collar_source ?? null,
                started_at: hole.started_at ?? null,
                completed_at: hole.completed_at ?? null,
                completion_status: hole.completion_status ?? null,
                completion_notes: hole.completion_notes ?? null,
              };
            })
            .filter((hole) => hole.collar_longitude != null && hole.collar_latitude != null)
        );

        setAllAssets(
          assetRows
            .map((asset) => {
              const baseAsset = {
                id: asset.id,
                organization_id: asset.organization_id,
                name: asset.name || "Unnamed asset",
                project_id: asset.project_id || "",
                project_name: asset.projects?.name || "No project",
                project_crs_code: asset.projects?.coordinate_crs_code || null,
                project_crs_name: asset.projects?.coordinate_crs_name || null,
                status: asset.status || "",
                asset_type_name: asset.asset_types?.name || "",
                location_name: asset.asset_locations?.name || "",
                easting: asset.easting ?? null,
                northing: asset.northing ?? null,
                longitude: asset.longitude ?? null,
                latitude: asset.latitude ?? null,
                coordinate_source: asset.coordinate_source ?? null,
              };

              const derived = deriveMapAssetCoordinates(baseAsset);
              return {
                ...baseAsset,
                longitude: derived.longitude,
                latitude: derived.latitude,
                coordinate_derived: derived.coordinateDerived,
              };
            })
            .filter((asset) => asset.longitude != null && asset.latitude != null)
        );
      } catch (evt) {
        if (!active) return;
        const message = evt?.message || "Failed to load map holes";
        setAllHoles([]);
        setAllAssets([]);
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

  const assetProjects = useMemo(() => {
    const projectMap = new Map();
    (allAssets || []).forEach((asset) => {
      const key = asset.project_id || "unassigned";
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          id: key,
          name: asset.project_name || "No project",
          assets: [],
        });
      }
      projectMap.get(key).assets.push(asset);
    });

    return Array.from(projectMap.values())
      .map((project) => ({
        ...project,
        assets: project.assets.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAssets]);

  const projectOptions = useMemo(() => {
    const optionMap = new Map();

    projects.forEach((project) => {
      optionMap.set(project.id, {
        id: project.id,
        name: project.name,
        holeCount: project.holes.length,
        assetCount: 0,
      });
    });

    assetProjects.forEach((project) => {
      if (!optionMap.has(project.id)) {
        optionMap.set(project.id, {
          id: project.id,
          name: project.name,
          holeCount: 0,
          assetCount: project.assets.length,
        });
      } else {
        optionMap.get(project.id).assetCount = project.assets.length;
      }
    });

    return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assetProjects, projects]);

  const filteredAssetProjects = useMemo(() => {
    if (!projectFilter) return assetProjects;
    return assetProjects.filter((project) => project.id === projectFilter);
  }, [assetProjects, projectFilter]);

  const visibleHoles = useMemo(() => {
    return filteredProjects.flatMap((project) => project.holes);
  }, [filteredProjects]);

  const visibleAssets = useMemo(() => {
    return filteredAssetProjects.flatMap((project) => project.assets);
  }, [filteredAssetProjects]);

  useEffect(() => {
    visibleHolesRef.current = visibleHoles;
  }, [visibleHoles]);

  useEffect(() => {
    visibleAssetsRef.current = visibleAssets;
  }, [visibleAssets]);

  const selectedHole = useMemo(() => {
    return visibleHoles.find((hole) => hole.id === selectedHoleId) || visibleHoles[0] || null;
  }, [selectedHoleId, visibleHoles]);

  const selectedAsset = useMemo(() => {
    return visibleAssets.find((asset) => asset.id === selectedAssetId) || visibleAssets[0] || null;
  }, [selectedAssetId, visibleAssets]);

  const selectedHoleMapId = selectedHole?.id || "";
  const selectedAssetMapId = selectedAsset?.id || "";
  const holeCollection = useMemo(() => makeHoleFeatureCollection(visibleHoles), [visibleHoles]);
  const assetCollection = useMemo(() => makeAssetFeatureCollection(visibleAssets), [visibleAssets]);

  const schematicLithById = useMemo(() => {
    const map = new Map();
    for (const type of schematicLithologyTypes || []) map.set(type.id, type);
    return map;
  }, [schematicLithologyTypes]);

  const schematicConstructionById = useMemo(() => {
    const map = new Map();
    for (const type of schematicConstructionTypes || []) map.set(type.id, type);
    return map;
  }, [schematicConstructionTypes]);

  const schematicAnnulusById = useMemo(() => {
    const map = new Map();
    for (const type of schematicAnnulusTypes || []) map.set(type.id, type);
    return map;
  }, [schematicAnnulusTypes]);

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
    setExpandedAssetProjects((prev) => {
      const next = { ...prev };
      filteredAssetProjects.forEach((project) => {
        if (typeof next[project.id] === "undefined") next[project.id] = false;
      });
      return next;
    });
  }, [filteredAssetProjects]);

  useEffect(() => {
    if (!visibleHoles.length) {
      setSelectedHoleId("");
      return;
    }
    if (!visibleHoles.some((hole) => hole.id === selectedHoleId)) {
      setSelectedHoleId(visibleHoles[0].id);
    }
  }, [selectedHoleId, visibleHoles]);

  useEffect(() => {
    if (!visibleAssets.length) {
      setSelectedAssetId("");
      return;
    }
    if (!visibleAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(visibleAssets[0].id);
    }
  }, [selectedAssetId, visibleAssets]);

  const frameRowsOnMap = (rows, options = {}) => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    const padding = options.padding || { top: 110, right: 90, bottom: 110, left: 90 };
    const maxZoom = typeof options.maxZoom === "number" ? options.maxZoom : 13;
    const duration = typeof options.duration === "number" ? options.duration : MAP_PROJECT_FRAME_DURATION;
    const singleZoom = typeof options.singleZoom === "number" ? options.singleZoom : 11.5;

    const mappableRows = (rows || []).filter((row) => {
      const lng = Number(row.collar_longitude ?? row.longitude);
      const lat = Number(row.collar_latitude ?? row.latitude);
      return Number.isFinite(lng) && Number.isFinite(lat);
    });

    if (!mappableRows.length) return;

    if (mappableRows.length === 1) {
      map.flyTo({
        center: [Number(mappableRows[0].collar_longitude ?? mappableRows[0].longitude), Number(mappableRows[0].collar_latitude ?? mappableRows[0].latitude)],
        zoom: singleZoom,
        speed: MAP_REFOCUS_SPEED,
        curve: MAP_REFOCUS_CURVE,
        easing: cinematicEase,
      });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    mappableRows.forEach((row) => {
      bounds.extend([Number(row.collar_longitude ?? row.longitude), Number(row.collar_latitude ?? row.latitude)]);
    });

    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration,
      easing: cinematicEase,
    });
  };

  const closeSchematicModal = () => {
    setSchematicHole(null);
    setSchematicError("");
  };

  const openSchematicModal = async (hole) => {
    if (!hole?.id || !hole.organization_id) return;

    schematicRequestRef.current += 1;
    const requestId = schematicRequestRef.current;

    if (popupRef.current) popupRef.current.remove();

    setSchematicHole(hole);
    setSchematicLoading(true);
    setSchematicError("");
    setSchematicGeologyRows([]);
    setSchematicConstructionRows([]);
    setSchematicAnnulusRows([]);

    try {
      const [lithologyRes, constructionTypeRes, annulusTypeRes, geologyRes, constructionRes, annulusRes] = await Promise.all([
        supabase
          .from("drillhole_lithology_types")
          .select("id, name, color, sort_order, is_active")
          .eq("organization_id", hole.organization_id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("drillhole_construction_types")
          .select("id, name, color, sort_order, is_active")
          .eq("organization_id", hole.organization_id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("drillhole_annulus_types")
          .select("id, name, color, sort_order, is_active")
          .eq("organization_id", hole.organization_id)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("drillhole_geology_intervals")
          .select("id, from_m, to_m, lithology_type_id, notes")
          .eq("organization_id", hole.organization_id)
          .eq("hole_id", hole.id)
          .order("from_m", { ascending: true }),
        supabase
          .from("drillhole_construction_intervals")
          .select("id, from_m, to_m, construction_type_id, notes")
          .eq("organization_id", hole.organization_id)
          .eq("hole_id", hole.id)
          .order("from_m", { ascending: true }),
        supabase
          .from("drillhole_annulus_intervals")
          .select("id, from_m, to_m, annulus_type_id, notes")
          .eq("organization_id", hole.organization_id)
          .eq("hole_id", hole.id)
          .order("from_m", { ascending: true }),
      ]);

      const responses = [lithologyRes, constructionTypeRes, annulusTypeRes, geologyRes, constructionRes, annulusRes];
      const firstError = responses.find((response) => response.error)?.error;
      if (firstError) throw firstError;
      if (requestId !== schematicRequestRef.current) return;

      setSchematicLithologyTypes(
        (lithologyRes.data || []).map((type) => ({
          id: type.id,
          name: type.name || "",
          color: type.color || "#64748b",
          sort_order: type.sort_order ?? 0,
          is_active: type.is_active !== false,
        }))
      );
      setSchematicConstructionTypes(
        (constructionTypeRes.data || []).map((type) => ({
          id: type.id,
          name: type.name || "",
          color: type.color || "#64748b",
          sort_order: type.sort_order ?? 0,
          is_active: type.is_active !== false,
        }))
      );
      setSchematicAnnulusTypes(
        (annulusTypeRes.data || []).map((type) => ({
          id: type.id,
          name: type.name || "",
          color: type.color || "#64748b",
          sort_order: type.sort_order ?? 0,
          is_active: type.is_active !== false,
        }))
      );
      setSchematicGeologyRows(
        (geologyRes.data || []).map((row) => ({
          id: row.id,
          from_m: row.from_m ?? "",
          to_m: row.to_m ?? "",
          lithology_type_id: row.lithology_type_id || "",
          notes: row.notes || "",
        }))
      );
      setSchematicConstructionRows(
        (constructionRes.data || []).map((row) => ({
          id: row.id,
          from_m: row.from_m ?? "",
          to_m: row.to_m ?? "",
          construction_type_id: row.construction_type_id || "",
          notes: row.notes || "",
        }))
      );
      setSchematicAnnulusRows(
        (annulusRes.data || []).map((row) => ({
          id: row.id,
          from_m: row.from_m ?? "",
          to_m: row.to_m ?? "",
          annulus_type_id: row.annulus_type_id || "",
          notes: row.notes || "",
        }))
      );
    } catch (evt) {
      if (requestId !== schematicRequestRef.current) return;
      const message = evt?.message || "Could not load hole schematic.";
      setSchematicError(message);
      toast.error(message);
    } finally {
      if (requestId === schematicRequestRef.current) {
        setSchematicLoading(false);
      }
    }
  };

  const renderPopupHtml = (hole) => {
    if (!hole) return "";
    const stateTone = getHoleStateTone(hole.state);

    return `
      <div style="width:188px;padding:10px 10px 10px 6px;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(186,230,253,0.78);">Hole</div>
          <div style="font-size:13px;font-weight:700;line-height:1.15;color:#f8fafc;word-break:break-word;">${hole.hole_id || "Unnamed hole"}</div>
          <div style="font-size:10px;line-height:1.3;color:rgba(226,232,240,0.78);word-break:break-word;">${hole.project_name || "No project"}</div>
          <div style="display:inline-flex;align-self:flex-start;max-width:100%;border:1px solid ${stateTone.border};background:${stateTone.background};color:${stateTone.text};border-radius:999px;padding:4px 7px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;line-height:1.05;">
            ${stateTone.label}
          </div>
        </div>
        <div style="margin-top:9px;display:grid;grid-template-columns:minmax(0,1fr);gap:6px;">
          <div style="width:calc(100% - 6px);margin-right:auto;border:1px solid rgba(148,163,184,0.18);background:rgba(15,23,42,0.5);border-radius:12px;padding:7px 9px;box-sizing:border-box;">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(148,163,184,0.84);">Depth</div>
            <div style="margin-top:4px;font-size:12px;font-weight:700;color:#f8fafc;">${formatValue(hole.depth, " m")}</div>
          </div>
        </div>
        <button type="button" data-popup-action="open-schematic" style="display:block;margin-top:8px;width:calc(100% - 6px);margin-right:auto;box-sizing:border-box;border:none;border-radius:10px;background:linear-gradient(135deg,#22d3ee,#0ea5e9);padding:8px 10px;color:#082f49;font-size:9px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;box-shadow:0 10px 24px rgba(14,165,233,0.2);line-height:1.05;">
          View Schematic
        </button>
      </div>
    `;
  };

  const renderAssetPopupHtml = (asset) => {
    if (!asset) return "";

    return `
      <div style="width:232px;padding:14px 14px 14px 8px;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
        <div style="display:flex;flex-direction:column;gap:8px;min-width:0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(186,230,253,0.78);">Asset</div>
          <div style="font-size:15px;font-weight:700;line-height:1.2;color:#f8fafc;word-break:break-word;">${asset.name || "Unnamed asset"}</div>
          <div style="font-size:11px;line-height:1.35;color:rgba(226,232,240,0.78);word-break:break-word;">${asset.project_name || "No project"}</div>
          <div style="display:inline-flex;align-self:flex-start;max-width:100%;border:1px solid rgba(34,211,238,0.28);background:rgba(34,211,238,0.12);color:#a5f3fc;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;line-height:1.1;">
            ${asset.status || "Unknown"}
          </div>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;">
          <div style="width:calc(100% - 8px);margin-right:auto;border:1px solid rgba(148,163,184,0.18);background:rgba(15,23,42,0.5);border-radius:14px;padding:9px 11px;box-sizing:border-box;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(148,163,184,0.84);">Type</div>
            <div style="margin-top:5px;font-size:14px;font-weight:700;color:#f8fafc;">${asset.asset_type_name || "-"}</div>
          </div>
        </div>
      </div>
    `;
  };

  const applyPopupViewportLayout = (popup) => {
    const popupElement = popup?.getElement?.();
    if (!popupElement) return;

    popupElement.classList.toggle("hole-map-popup-mobile", isMobileViewport);
  };

  const focusHole = (hole, options = {}) => {
    if (!hole) return;
    setNavigatorTab("holes");
    setSelectedHoleId(hole.id);
    setMobilePanelTab("holes");

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const lng = Number(hole.collar_longitude);
    const lat = Number(hole.collar_latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo({
        center: [lng, lat],
        zoom: typeof options.zoom === "number" ? options.zoom : Math.max(map.getZoom(), 11.5),
        offset: [0, 120],
        speed: MAP_REFOCUS_SPEED,
        curve: MAP_REFOCUS_CURVE,
        easing: cinematicEase,
      });
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true, className: "hole-map-popup" });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderPopupHtml(hole)).addTo(map);
    applyPopupViewportLayout(popupRef.current);

    const schematicButton = popupRef.current.getElement()?.querySelector('[data-popup-action="open-schematic"]');
    if (schematicButton) {
      schematicButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void openSchematicModal(hole);
      }, { once: true });
    }
  };

  const focusAsset = (asset, options = {}) => {
    if (!asset) return;
    setNavigatorTab("assets");
    setSelectedAssetId(asset.id);
    setMobilePanelTab("assets");

    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    const lng = Number(asset.longitude);
    const lat = Number(asset.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

    if (options.flyTo !== false) {
      map.flyTo({
        center: [lng, lat],
        zoom: typeof options.zoom === "number" ? options.zoom : Math.max(map.getZoom(), 12),
        offset: [0, 120],
        speed: MAP_REFOCUS_SPEED,
        curve: MAP_REFOCUS_CURVE,
        easing: cinematicEase,
      });
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: true, className: "hole-map-popup" });
    }

    popupRef.current.setLngLat([lng, lat]).setHTML(renderAssetPopupHtml(asset)).addTo(map);
    applyPopupViewportLayout(popupRef.current);
  };

  useEffect(() => {
    applyPopupViewportLayout(popupRef.current);
  }, [isMobileViewport]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    if (map.getSource(HOLES_SOURCE_ID)) {
      map.getSource(HOLES_SOURCE_ID).setData(holeCollection);
    } else {
      map.addSource(HOLES_SOURCE_ID, { type: "geojson", data: holeCollection });
    }

    if (map.getSource(ASSETS_SOURCE_ID)) {
      map.getSource(ASSETS_SOURCE_ID).setData(assetCollection);
    } else {
      map.addSource(ASSETS_SOURCE_ID, { type: "geojson", data: assetCollection });
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
          "circle-color": HOLE_STATE_COLOR_EXPRESSION,
          "circle-stroke-color": "#082f49",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0.96,
        },
      });
    }

    if (map.getLayer(HOLES_CIRCLE_LAYER_ID)) {
      map.setPaintProperty(HOLES_CIRCLE_LAYER_ID, "circle-color", HOLE_STATE_COLOR_EXPRESSION);
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

    if (!map.getLayer(ASSETS_GLOW_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_GLOW_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 16,
          "circle-color": ASSET_COLOR,
          "circle-opacity": 0.12,
          "circle-blur": 0.8,
        },
      });
    }

    if (!map.getLayer(ASSETS_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_CIRCLE_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 6,
          "circle-color": ASSET_COLOR,
          "circle-stroke-color": "#fbcfe8",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
    }

    if (map.getLayer(ASSETS_CIRCLE_LAYER_ID)) {
      map.setPaintProperty(ASSETS_CIRCLE_LAYER_ID, "circle-color", ASSET_COLOR);
    }

    if (!map.getLayer(ASSETS_SELECTED_LAYER_ID)) {
      map.addLayer({
        id: ASSETS_SELECTED_LAYER_ID,
        type: "circle",
        source: ASSETS_SOURCE_ID,
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(244,114,182,0.18)",
          "circle-stroke-color": "#f9a8d4",
          "circle-stroke-width": 3,
        },
        filter: ["==", ["get", "id"], ""],
      });
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHoleMapId]);
    map.setFilter(ASSETS_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedAssetMapId]);

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
        focusHole(hole, { zoom: map.getZoom() });
      };
      const handleAssetLayerClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const asset = visibleAssetsRef.current.find((row) => String(row.id) === String(feature.properties?.id));
        if (!asset) return;
        focusAsset(asset, { zoom: map.getZoom() });
      };

      map.on("mouseenter", HOLES_CIRCLE_LAYER_ID, setPointerCursor);
      map.on("mouseenter", HOLES_SELECTED_LAYER_ID, setPointerCursor);
      map.on("mouseenter", ASSETS_CIRCLE_LAYER_ID, setPointerCursor);
      map.on("mouseenter", ASSETS_SELECTED_LAYER_ID, setPointerCursor);
      map.on("mouseleave", HOLES_CIRCLE_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", HOLES_SELECTED_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", ASSETS_CIRCLE_LAYER_ID, clearPointerCursor);
      map.on("mouseleave", ASSETS_SELECTED_LAYER_ID, clearPointerCursor);
      map.on("click", HOLES_CIRCLE_LAYER_ID, handleHoleLayerClick);
      map.on("click", HOLES_SELECTED_LAYER_ID, handleHoleLayerClick);
      map.on("click", ASSETS_CIRCLE_LAYER_ID, handleAssetLayerClick);
      map.on("click", ASSETS_SELECTED_LAYER_ID, handleAssetLayerClick);
      handlersBoundRef.current = true;
    }

    map.setFilter(HOLES_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedHoleMapId]);
    map.setFilter(ASSETS_SELECTED_LAYER_ID, ["==", ["get", "id"], selectedAssetMapId]);

    if (!visibleHoles.length && !visibleAssets.length) {
      if (popupRef.current) popupRef.current.remove();
      return;
    }
  }, [assetCollection, holeCollection, mapStatus, selectedAssetMapId, selectedHoleMapId, visibleAssets.length, visibleHoles.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const showAllLayers = !isMobileViewport || mobilePanelTab === "all";
    const showAssetLayers = showAllLayers || mobilePanelTab === "assets";
    const showHoleLayers = showAllLayers || mobilePanelTab === "projects" || mobilePanelTab === "holes";

    const setLayerVisibility = (layerId, visible) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    };

    setLayerVisibility(HOLES_GLOW_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_CIRCLE_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_SELECTED_LAYER_ID, showHoleLayers);
    setLayerVisibility(HOLES_LABEL_LAYER_ID, showHoleLayers);
    setLayerVisibility(ASSETS_GLOW_LAYER_ID, showAssetLayers);
    setLayerVisibility(ASSETS_CIRCLE_LAYER_ID, showAssetLayers);
    setLayerVisibility(ASSETS_SELECTED_LAYER_ID, showAssetLayers);
  }, [isMobileViewport, mapStatus, mobilePanelTab]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReadyRef.current) return;

    const visibleMapRows = isMobileViewport
      ? mobilePanelTab === "assets"
        ? visibleAssets
        : mobilePanelTab === "all"
          ? [...visibleHoles, ...visibleAssets]
          : visibleHoles
      : [...visibleHoles, ...visibleAssets];

    if (!visibleMapRows.length) {
      if (popupRef.current) popupRef.current.remove();
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      return;
    }

    frameRowsOnMap(visibleMapRows);
  }, [isMobileViewport, mapStatus, mobilePanelTab, visibleAssets, visibleHoles]);

  const totalProjects = projectOptions.length;
  const totalVisibleProjects = projectFilter ? projectOptions.filter((project) => project.id === projectFilter).length : projectOptions.length;
  const totalVisibleHoles = visibleHoles.length;
  const totalVisibleAssets = visibleAssets.length;
  const totalShared = allHoles.filter((hole) => hole.organization_id !== orgId).length;
  const showCreateProjectPrompt = !loading && projectScope === "own" && totalProjects === 0;

  const toggleProjectExpanded = (project, isExpanded) => {
    setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }));
    frameRowsOnMap(project.holes, {
      padding: { top: 56, right: 38, bottom: 56, left: 38 },
      maxZoom: 15.2,
      duration: 3000,
      singleZoom: 14.1,
    });
  };

  const toggleAssetProjectExpanded = (project, isExpanded) => {
    setExpandedAssetProjects((prev) => ({ ...prev, [project.id]: !isExpanded }));
    frameRowsOnMap(project.assets, {
      padding: { top: 56, right: 38, bottom: 56, left: 38 },
      maxZoom: 15.2,
      duration: 3000,
      singleZoom: 14.1,
    });
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px] xl:max-w-[700px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Visible Projects</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleProjects}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mapped Holes</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleHoles}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mapped Assets</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : totalVisibleAssets}</div>
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
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.holeCount} holes, {project.assetCount} assets)
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
              <div className="w-full">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Map Navigator</div>
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${navigatorTab === "holes" ? "bg-amber-300 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setNavigatorTab("holes")}
                  >
                    Holes
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${navigatorTab === "assets" ? "bg-cyan-300 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setNavigatorTab("assets")}
                  >
                    Assets
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {navigatorTab === "holes" ? (
                <ProjectAccordionList
                  loading={loading}
                  projects={filteredProjects}
                  expandedProjects={expandedProjects}
                  onToggleProject={toggleProjectExpanded}
                  selectedHoleId={selectedHole?.id || ""}
                  onSelectHole={focusHole}
                />
              ) : (
                <AssetAccordionList
                  loading={loading}
                  projects={filteredAssetProjects}
                  expandedProjects={expandedAssetProjects}
                  onToggleProject={toggleAssetProjectExpanded}
                  selectedAssetId={selectedAsset?.id || ""}
                  onSelectAsset={focusAsset}
                />
              )}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_30px_100px_rgba(2,6,23,0.42)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(8,47,73,0.28),transparent)]" />
              <div className="relative border-b border-white/10 px-4 py-4 md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Map View</div>
                    <div className="mt-1 text-lg font-semibold text-white">{mobilePanelTab === "projects" ? "Projects and holes" : mobilePanelTab === "holes" ? "Hole attributes" : mobilePanelTab === "assets" ? "Mapped assets" : "All mapped items"}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                    {mobilePanelTab === "projects"
                      ? `${totalVisibleProjects} projects`
                      : mobilePanelTab === "holes"
                        ? selectedHole?.hole_id || "No selection"
                        : mobilePanelTab === "assets"
                          ? `${totalVisibleAssets} assets`
                        : `${totalVisibleHoles + totalVisibleAssets} items`}
                  </div>
                </div>
                <div className="mt-4 inline-flex w-full items-center gap-2 rounded-2xl bg-white/[0.04] p-1.5">
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "projects" ? "bg-cyan-300 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setMobilePanelTab("projects")}
                  >
                    Projects
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "holes" ? "bg-amber-300 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setMobilePanelTab("holes")}
                  >
                    Holes
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "assets" ? "bg-rose-300 text-slate-950 shadow-[0_12px_28px_rgba(244,114,182,0.22)]" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setMobilePanelTab("assets")}
                  >
                    Assets
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition ${mobilePanelTab === "all" ? "bg-slate-200 text-slate-950" : "text-slate-200 hover:bg-white/8"}`}
                    onClick={() => setMobilePanelTab("all")}
                  >
                    All
                  </button>
                </div>
              </div>
              <div className="relative hidden items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:flex md:px-5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Map canvas</div>
                  <div className="mt-1 text-lg font-semibold text-white">Hole collars and mapped assets</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalVisibleHoles} visible holes</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{totalVisibleAssets} visible assets</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{projectFilter ? "Filtered project" : "Portfolio view"}</span>
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 md:bottom-4 md:left-4">
                <div className="pointer-events-auto">
                  <HoleStateLegend />
                </div>
              </div>
              {showCreateProjectPrompt ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 md:p-6">
                  <div className="pointer-events-auto w-full max-w-xl rounded-[30px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl md:p-5">
                    <EmptyProjectPrompt />
                  </div>
                </div>
              ) : null}
              <div ref={mapContainerRef} className="h-[58svh] min-h-[400px] w-full md:h-[58vh] md:min-h-[480px]" />
            </div>

            <div className="xl:hidden overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/60 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mobile Navigator</div>
                    <div className="mt-1 text-lg font-semibold text-white">{mobilePanelTab === "projects" ? "Projects and holes" : mobilePanelTab === "holes" ? "Hole attributes" : mobilePanelTab === "assets" ? "Mapped assets" : "All mapped items"}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                    {mobilePanelTab === "projects"
                      ? `${totalVisibleProjects} projects`
                      : mobilePanelTab === "holes"
                        ? selectedHole?.hole_id || "No selection"
                        : mobilePanelTab === "assets"
                          ? `${totalVisibleAssets} assets`
                        : `${totalVisibleHoles + totalVisibleAssets} items`}
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
                      {projectOptions.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} ({project.holeCount} holes, {project.assetCount} assets)
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
              ) : mobilePanelTab === "holes" ? (
                <HoleAttributesPanel selectedHole={selectedHole} mobile />
              ) : mobilePanelTab === "assets" ? (
                <AssetAccordionList
                  loading={loading}
                  projects={filteredAssetProjects}
                  expandedProjects={expandedAssetProjects}
                  onToggleProject={toggleAssetProjectExpanded}
                  selectedAssetId={selectedAsset?.id || ""}
                  onSelectAsset={focusAsset}
                  compact
                />
              ) : (
                <div className="space-y-5 p-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Hole Programs</div>
                    <ProjectAccordionList
                      loading={loading}
                      projects={filteredProjects}
                      expandedProjects={expandedProjects}
                      onToggleProject={toggleProjectExpanded}
                      selectedHoleId={selectedHole?.id || ""}
                      onSelectHole={focusHole}
                      compact
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Mapped Assets</div>
                    <AssetAccordionList
                      loading={loading}
                      projects={filteredAssetProjects}
                      expandedProjects={expandedAssetProjects}
                      onToggleProject={toggleAssetProjectExpanded}
                      selectedAssetId={selectedAsset?.id || ""}
                      onSelectAsset={focusAsset}
                      compact
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl xl:block">
              <div className="border-b border-white/10 px-4 py-4 md:px-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{navigatorTab === "holes" ? "Selected Hole" : "Selected Asset"}</div>
                    <div className="mt-1 text-lg font-semibold text-white">Attributes</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    {navigatorTab === "holes"
                      ? selectedHole
                        ? `Inspecting ${selectedHole.hole_id}`
                        : "Click a hole on the map or in the project list."
                      : selectedAsset
                        ? `Inspecting ${selectedAsset.name}`
                        : "Click an asset on the map or in the assets list."}
                  </div>
                </div>
              </div>

              {navigatorTab === "holes" ? <HoleAttributesPanel selectedHole={selectedHole} /> : <AssetAttributesPanel selectedAsset={selectedAsset} />}
            </div>
          </div>
        </section>
      </div>

      <HoleSchematicModal
        hole={schematicHole}
        loading={schematicLoading}
        error={schematicError}
        geologyRows={schematicGeologyRows}
        constructionRows={schematicConstructionRows}
        annulusRows={schematicAnnulusRows}
        lithById={schematicLithById}
        constructionById={schematicConstructionById}
        annulusById={schematicAnnulusById}
        onClose={closeSchematicModal}
      />
    </div>
  );
}
