"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { parseTable } from "@/lib/parseTable";
import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import { deriveHoleCoordinates } from "@/lib/holeCoordinates";
import { fetchOrgHoleDescriptors, resolveHoleDescriptorTokens } from "@/lib/holeDescriptors";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";

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
  { key: "descriptor_keys", required: false, description: "Optional descriptor keys or names separated with | ; or newline." },
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
  const dateValue = new Date(txt);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
}

function resolveDefaultProjectId(projects, preferredProjectId = "") {
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) return preferredProjectId;
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

export default function BulkUploaderTab({ projectScope = "own" }) {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();

  const [projects, setProjects] = useState([]);
  const [availableDescriptors, setAvailableDescriptors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [parsed, setParsed] = useState([]);

  const sampleHeaders = useMemo(
    () =>
      "hole_id,depth,planned_depth,water_level_m,azimuth,dip,collar_longitude,collar_latitude,collar_easting,collar_northing,collar_elevation_m,collar_source,started_at,completed_at,completion_status,completion_notes,drilling_diameter,drilling_contractor,descriptor_keys\n" +
      "HOLE-001,150,200,12.5,135.0,-60.0,121.12345,-27.12345,,,385.2,gps,2026-03-01T06:00,2026-03-02T18:00,completed,Completed to planned depth,NQ,North Drilling,diamond|hydrogeology\n" +
      "HOLE-002,220,250,18.0,142.5,-55.0,,,500120.4,6987450.2,388.1,survey,2026-03-03T07:30,2026-03-04T16:40,completed,Deviation survey complete,HQ,Westline Drilling,monitoring\n",
    []
  );

  useEffect(() => {
    if (!orgId || projectScope === "shared") {
      setProjects([]);
      setAvailableDescriptors([]);
      setBulkProjectId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,coordinate_crs_code,coordinate_crs_name")
        .eq("organization_id", orgId)
        .order("name", { ascending: true });

      if (error) {
        toast.error(error.message || "Failed to load projects");
        setProjects([]);
        setLoading(false);
        return;
      }

      const nextProjects = data || [];
      setProjects(nextProjects);
      setBulkProjectId((current) => resolveDefaultProjectId(nextProjects, current));

      try {
        const descriptorRows = await fetchOrgHoleDescriptors(supabase, orgId);
        setAvailableDescriptors(descriptorRows);
      } catch (descriptorError) {
        setAvailableDescriptors([]);
        toast.error(descriptorError?.message || "Failed to load hole descriptors");
      }

      setLoading(false);
    })();
  }, [orgId, projectScope, supabase]);

  const bulkAllowedHeaders = useMemo(() => BULK_COLUMNS.map((column) => column.key), []);
  const bulkRequiredHeaders = useMemo(() => BULK_COLUMNS.filter((column) => column.required).map((column) => column.key), []);
  const bulkHeaderCsv = useMemo(() => BULK_COLUMNS.map((column) => column.key).join(","), []);
  const bulkHeaderTsv = useMemo(() => BULK_COLUMNS.map((column) => column.key).join("\t"), []);
  const bulkHeadersPresent = useMemo(() => Object.keys(parsed?.[0] || {}), [parsed]);
  const bulkInvalidHeaders = useMemo(
    () => bulkHeadersPresent.filter((header) => !bulkAllowedHeaders.includes(header)),
    [bulkAllowedHeaders, bulkHeadersPresent]
  );
  const bulkMissingRequired = useMemo(
    () => bulkRequiredHeaders.filter((header) => !bulkHeadersPresent.includes(header)),
    [bulkHeadersPresent, bulkRequiredHeaders]
  );
  const bulkValidRowsCount = useMemo(
    () => (parsed || []).filter((row) => String(row?.hole_id || "").trim()).length,
    [parsed]
  );
  const selectedBulkProject = useMemo(
    () => projects.find((project) => project.id === bulkProjectId) || null,
    [projects, bulkProjectId]
  );

  const bulkCanImport =
    projectScope !== "shared" &&
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
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Headers copied. Paste into Excel to create columns.");
    } catch {
      toast.error("Could not copy headers. Use the sample block as a fallback.");
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
    const descriptorAssignments = [];
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

      const descriptorMatch = resolveHoleDescriptorTokens(row.descriptor_keys, availableDescriptors);
      if (descriptorMatch.unmatchedTokens.length) {
        return toast.error(`${rowLabel}: unknown descriptors ${descriptorMatch.unmatchedTokens.join(", ")}`);
      }

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

      descriptorAssignments.push({
        hole_id: holeId,
        descriptorIds: descriptorMatch.descriptorIds,
      });
    }

    if (!payloads.length) return toast.error("No valid rows (missing hole_id)");

    setImporting(true);
    const { data: insertedRows, error } = await supabase.from("holes").insert(payloads).select("id,hole_id");
    setImporting(false);
    if (error) return toast.error(error.message);

    const assignmentRows = [];
    const insertedByHoleId = new Map((insertedRows || []).map((row) => [row.hole_id, row.id]));
    descriptorAssignments.forEach((row) => {
      const insertedHoleId = insertedByHoleId.get(row.hole_id);
      if (!insertedHoleId) return;
      row.descriptorIds.forEach((descriptorId) => {
        assignmentRows.push({
          organization_id: orgId || null,
          hole_id: insertedHoleId,
          descriptor_id: descriptorId,
        });
      });
    });

    if (assignmentRows.length) {
      const { error: assignmentError } = await supabase.from("hole_descriptor_assignments").insert(assignmentRows);
      if (assignmentError) return toast.error(assignmentError.message || "Holes imported but descriptor assignments failed");
    }

    toast.success(`Inserted ${payloads.length} holes`);
    setBulkText("");
    setParsed([]);
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      <CoreTaskPanelHeader
        eyebrow="Bulk Uploader"
        title="Import holes in batches"
        description="Paste straight from Excel, CSV, or TSV, validate the dataset, and import holes into a selected project with coordinate checks before anything is written."
        stats={[
          { label: "projects", value: loading ? "..." : projects.length },
          { label: "parsed rows", value: parsed.length },
          { label: "valid rows", value: bulkValidRowsCount },
        ]}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" className="btn btn-3d-glass" onClick={copyBulkHeaders} title={bulkHeaderCsv}>
              Copy headers
            </button>
            <button type="button" className="btn btn-3d-glass" onClick={downloadBulkSample}>
              Download sample
            </button>
          </div>
        }
      />

      {projectScope === "shared" ? (
        <div className="rounded-[28px] border border-amber-300/15 bg-amber-400/5 p-5 text-sm text-amber-100 shadow-[0_24px_80px_rgba(2,6,23,0.25)]">
          Bulk upload is only available in My projects. Switch out of Client shared to import holes.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]">
          <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.3)] space-y-4 md:p-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                Upload Into Project
                <select className="select-gradient-sm mt-2 w-full" value={bulkProjectId} onChange={(e) => setBulkProjectId(e.target.value)}>
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs text-slate-400">Every imported hole will be assigned to this project.</div>
              <div className="text-xs text-slate-400">Use the optional `descriptor_keys` column to attach org-defined hole descriptors during import.</div>
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

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-200">Paste CSV/TSV</label>
                <div className="text-xs text-slate-400">Tabs and commas supported</div>
              </div>
              <textarea
                autoFocus
                rows={14}
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
              <div className="mt-2 text-xs text-slate-400">Tip: paste directly from Excel or Google Sheets. Tab-delimited paste is supported.</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <div className="text-sm font-medium text-slate-200">Validation</div>
              {!bulkProjectId ? <div className="text-xs text-rose-300">Choose a project to enable import.</div> : null}
              {!availableDescriptors.length ? <div className="text-xs text-slate-400">No active hole descriptors are configured for this org yet. Leave `descriptor_keys` blank or create descriptors first.</div> : null}
              {bulkInvalidHeaders.length > 0 ? <div className="text-xs text-amber-300">Unexpected headers: {bulkInvalidHeaders.join(", ")}</div> : null}
              {bulkMissingRequired.length > 0 ? <div className="text-xs text-rose-300">Missing required headers: {bulkMissingRequired.join(", ")}</div> : null}
              {bulkInvalidHeaders.length === 0 && bulkMissingRequired.length === 0 && parsed.length > 0 ? <div className="text-xs text-emerald-300">Headers look good and ready to import.</div> : null}
              {parsed.length === 0 ? <div className="text-xs text-slate-400">Paste records to start validation.</div> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-h-0 overflow-auto">
              <div className="text-sm font-medium text-slate-200 mb-2">Column guide</div>
              <div className="space-y-1">
                {BULK_COLUMNS.map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3 text-xs">
                    <div className="text-slate-200 font-mono">{column.key}</div>
                    <div className="text-right text-slate-400">{column.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.3)] flex flex-col gap-4 md:p-5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Parsed rows</div>
                <div className="text-base font-semibold text-slate-100">{parsed.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Valid rows</div>
                <div className="text-base font-semibold text-emerald-300">{bulkValidRowsCount}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Invalid headers</div>
                <div className="text-base font-semibold text-amber-300">{bulkInvalidHeaders.length}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Required missing</div>
                <div className="text-base font-semibold text-rose-300">{bulkMissingRequired.length}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-200">Preview (first 200 rows)</div>
              <div className="text-xs text-slate-400">Scroll horizontally for all fields</div>
            </div>

            <div className="table-container flex-1 min-h-[420px] overflow-hidden">
              <div className="h-full w-full overflow-x-auto overflow-y-auto">
                <table className="table min-w-[2200px]">
                  <thead>
                    <tr>
                      <th className="left-0 z-20" style={{ left: 0, minWidth: 170 }}>hole_id</th>
                      <th className="left-0 z-20" style={{ left: 170, minWidth: 110 }}>depth</th>
                      {BULK_COLUMNS.filter((column) => !["hole_id", "depth"].includes(column.key)).map((column) => (
                        <th key={column.key}>{column.key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(parsed || []).slice(0, 200).map((row, index) => (
                      <tr key={index}>
                        <td className="sticky left-0 z-10 bg-slate-900/95" style={{ left: 0, minWidth: 170 }}>{row.hole_id}</td>
                        <td className="sticky left-0 z-10 bg-slate-900/95" style={{ left: 170, minWidth: 110 }}>{row.depth}</td>
                        {BULK_COLUMNS.filter((column) => !["hole_id", "depth"].includes(column.key)).map((column) => (
                          <td key={column.key}>{row[column.key]}</td>
                        ))}
                      </tr>
                    ))}
                    {parsed.length === 0 ? (
                      <tr>
                        <td colSpan={BULK_COLUMNS.length} className="py-8 text-center text-sm text-slate-400">
                          Paste data to preview records.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button type="button" onClick={onBulkUpload} className="btn btn-3d-primary" disabled={!bulkCanImport}>
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
              <div className="ml-auto text-xs text-slate-400">Required: <span className="font-mono text-slate-300">hole_id</span> header and project selection</div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}