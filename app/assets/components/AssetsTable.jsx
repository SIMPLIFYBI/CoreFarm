"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { EditIconButton, DeleteIconButton } from "@/app/components/ActionIconButton";
import { useOrg } from "@/lib/OrgContext";
import { getAustralianProjectCrsByCode } from "@/lib/coordinateSystems";
import { convertProjectedToWgs84 } from "@/lib/coordinateTransforms";

function deriveAssetCoordinates(asset) {
  const longitude = asset?.longitude ?? null;
  const latitude = asset?.latitude ?? null;
  if (longitude != null && latitude != null) {
    return { longitude, latitude, coordinateDerived: false };
  }

  if (asset?.easting == null || asset?.northing == null || !asset?.projects?.coordinate_crs_code) {
    return { longitude, latitude, coordinateDerived: false };
  }

  try {
    const converted = convertProjectedToWgs84({
      crsCode: asset.projects.coordinate_crs_code,
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

export default function AssetsTable({
  TABLE_HEAD_ROW,
  TABLE_ROW,
  title = "Assets",
  addButtonLabel = "Add Asset",
}) {
  const PAGE_SIZE = 30;
  const { orgId } = useOrg();

  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "name", dir: "asc" }); // name|type|location|status

  const [assetTypeFilter, setAssetTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [form, setForm] = useState({
    name: "",
    asset_type_id: "",
    location_id: "",
    project_id: "",
    easting: "",
    northing: "",
    longitude: "",
    latitude: "",
    coordinate_source: "manual",
    status: "Active",
  });

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;

    async function load() {
      if (!orgId) {
        if (!mounted) return;
        setAssets([]);
        setLocations([]);
        setAssetTypes([]);
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const [assetsRes, locRes, typesRes, projectsRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id, name, asset_type_id, location_id, project_id, easting, northing, longitude, latitude, coordinate_source, status, asset_types(name), asset_locations(name), projects(name, coordinate_crs_code, coordinate_crs_name)")
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
        supabase.from("asset_locations").select("id, name").eq("organization_id", orgId).order("name", { ascending: true }),
        supabase.from("asset_types").select("id, name").order("name", { ascending: true }),
        supabase.from("projects").select("id, name, coordinate_crs_code, coordinate_crs_name").eq("organization_id", orgId).order("name", { ascending: true }),
      ]);

      if (!mounted) return;

      setAssets(
        (assetsRes.data || []).map((asset) => {
          const derived = deriveAssetCoordinates(asset);
          return {
            ...asset,
            longitude: derived.longitude,
            latitude: derived.latitude,
            coordinateDerived: derived.coordinateDerived,
          };
        })
      );
      setLocations(locRes.data || []);
      setAssetTypes(typesRes.data || []);
      setProjects(projectsRes.data || []);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [orgId, showModal]);

  const filteredAssets = useMemo(() => {
    return (assets || []).filter((asset) => {
      if (assetTypeFilter && asset.asset_type_id !== assetTypeFilter) return false;
      if (locationFilter && asset.location_id !== locationFilter) return false;
      return true;
    });
  }, [assets, assetTypeFilter, locationFilter]);

  // keep page valid when filtered size changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((filteredAssets.length || 0) / PAGE_SIZE));
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [filteredAssets.length]);

  const getSortValue = (asset, key) => {
    switch (key) {
      case "name":
        return asset?.name ?? "";
      case "type":
        return asset?.asset_types?.name ?? "";
      case "location":
        return asset?.asset_locations?.name ?? "";
      case "status":
        return asset?.status ?? "";
      default:
        return "";
    }
  };

  const sortedAssets = useMemo(() => {
    const dir = sort.dir === "desc" ? -1 : 1;
    const arr = [...filteredAssets];

    arr.sort((a, b) => {
      const av = String(getSortValue(a, sort.key)).toLowerCase();
      const bv = String(getSortValue(b, sort.key)).toLowerCase();

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return arr;
  }, [filteredAssets, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((sortedAssets.length || 0) / PAGE_SIZE)),
    [sortedAssets.length]
  );

  const pagedAssets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedAssets.slice(start, start + PAGE_SIZE);
  }, [sortedAssets, page]);

  const toggleSort = (key) => {
    setPage(1);
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sort.key !== key) return null;
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  const openModal = (asset = null) => {
    setEditAsset(asset);
    setForm(
      asset
        ? {
            name: asset.name || "",
            asset_type_id: asset.asset_type_id || "",
            location_id: asset.location_id || "",
            project_id: asset.project_id || "",
            easting: asset.easting ?? "",
            northing: asset.northing ?? "",
            longitude: asset.longitude ?? "",
            latitude: asset.latitude ?? "",
            coordinate_source: asset.coordinate_source || "manual",
            status: asset.status || "Active",
          }
        : {
            name: "",
            asset_type_id: "",
            location_id: "",
            project_id: "",
            easting: "",
            northing: "",
            longitude: "",
            latitude: "",
            coordinate_source: "manual",
            status: "Active",
          }
    );
    setShowModal(true);
  };

  const toNullableNumber = (value) => {
    if (value === "" || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const selectedProject = projects.find((project) => project.id === form.project_id) || null;
  const selectedAssetType = assetTypes.find((type) => type.id === form.asset_type_id) || null;
  const selectedProjectCrs = getAustralianProjectCrsByCode(selectedProject?.coordinate_crs_code) || null;

  const handleSave = async () => {
    const supabase = supabaseBrowser();
    const trimmedName = form.name.trim();
    const hasEasting = form.easting !== "";
    const hasNorthing = form.northing !== "";
    const hasProjectedCoordinates = hasEasting && hasNorthing;
    const manualLongitude = toNullableNumber(form.longitude);
    const manualLatitude = toNullableNumber(form.latitude);

    if (!trimmedName) {
      window.alert("Enter an asset name before saving.");
      return;
    }

    if ((hasEasting || hasNorthing) && !form.project_id) {
      window.alert("Select a project before entering easting and northing.");
      return;
    }

    if (hasEasting !== hasNorthing) {
      window.alert("Enter both easting and northing together.");
      return;
    }

    if (hasProjectedCoordinates && !selectedProject?.coordinate_crs_code) {
      window.alert("Set a project coordinate system before saving projected coordinates.");
      return;
    }

    if ((manualLongitude == null) !== (manualLatitude == null)) {
      window.alert("Enter both longitude and latitude together.");
      return;
    }

    if (!hasProjectedCoordinates && manualLongitude == null && manualLatitude == null) {
      window.alert("Enter either easting and northing or longitude and latitude before saving.");
      return;
    }

    if (!selectedAssetType?.name) {
      window.alert("Select an asset type before saving.");
      return;
    }

    let convertedCoordinates = null;
    if (hasProjectedCoordinates) {
      try {
        convertedCoordinates = convertProjectedToWgs84({
          crsCode: selectedProject.coordinate_crs_code,
          easting: form.easting,
          northing: form.northing,
        });
      } catch (error) {
        window.alert(error?.message || "Unable to convert projected coordinates for this project CRS.");
        return;
      }
    }

    const payload = {
      organization_id: orgId,
      name: trimmedName,
      asset_type: selectedAssetType.name,
      asset_type_id: form.asset_type_id || null,
      location_id: form.location_id || null,
      project_id: form.project_id || null,
      easting: toNullableNumber(form.easting),
      northing: toNullableNumber(form.northing),
      longitude: convertedCoordinates?.longitude ?? manualLongitude,
      latitude: convertedCoordinates?.latitude ?? manualLatitude,
      coordinate_source: form.coordinate_source || null,
      status: form.status,
    };

    setSaving(true);

    try {
      if (editAsset) {
        const { error } = await supabase.from("assets").update(payload).eq("id", editAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
    } catch (error) {
      window.alert(error?.message || "Unable to save asset.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) {
      window.alert(error.message || "Unable to delete asset.");
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <button className="btn btn-primary" onClick={() => openModal()} type="button">
          {addButtonLabel}
        </button>
      </div>

      <div className="glass rounded-xl border border-white/10 p-3 mb-4">
        <div className="flex flex-wrap md:flex-nowrap items-end gap-3">
          <label className="text-xs text-slate-300 min-w-[180px] flex-1 space-y-1.5">
            Asset Type
            <select
              className="select-gradient-sm"
              value={assetTypeFilter}
              onChange={(e) => {
                setAssetTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All asset types</option>
              {assetTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300 min-w-[180px] flex-1 space-y-1.5">
            Location
            <select
              className="select-gradient-sm"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block text-xs text-slate-300/80 whitespace-nowrap">
            Showing <span className="text-slate-100 font-medium">{sortedAssets.length}</span> assets
            </div>
            <button
              type="button"
              className="btn btn-xs inline-flex items-center gap-1.5"
              aria-label="Clear filters"
              title="Clear filters"
              onClick={() => {
                setAssetTypeFilter("");
                setLocationFilter("");
                setPage(1);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="hidden md:inline">Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 md:mx-0">
        <table className="w-full text-xs md:text-sm min-w-[720px]">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className="p-2 font-medium">
                <button type="button" className="hover:underline" onClick={() => toggleSort("name")}>
                  Name{sortIndicator("name")}
                </button>
              </th>
              <th className="p-2 font-medium">
                <button type="button" className="hover:underline" onClick={() => toggleSort("type")}>
                  Type{sortIndicator("type")}
                </button>
              </th>
              <th className="p-2 font-medium">
                <button type="button" className="hover:underline" onClick={() => toggleSort("location")}>
                  Location{sortIndicator("location")}
                </button>
              </th>
              <th className="p-2 hidden lg:table-cell font-medium">Project</th>
              <th className="p-2 hidden xl:table-cell font-medium">Coordinates</th>
              <th className="p-2 font-medium">
                <button type="button" className="hover:underline" onClick={() => toggleSort("status")}>
                  Status{sortIndicator("status")}
                </button>
              </th>
              <th className="p-2 font-medium text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-300/70">
                  Loading...
                </td>
              </tr>
            ) : pagedAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-300/70">
                  No assets found.
                </td>
              </tr>
            ) : (
              pagedAssets.map((asset) => (
                <tr key={asset.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{asset.name}</td>
                  <td className="p-2">{asset.asset_types?.name || "-"}</td>
                  <td className="p-2">{asset.asset_locations?.name || "-"}</td>
                  <td className="p-2 hidden lg:table-cell">{asset.projects?.name || "-"}</td>
                  <td className="p-2 hidden xl:table-cell text-slate-300/80">
                    {asset.easting != null && asset.northing != null
                      ? `E ${asset.easting} / N ${asset.northing}`
                      : asset.longitude != null && asset.latitude != null
                        ? `${asset.longitude}, ${asset.latitude}`
                        : "-"}
                  </td>
                  <td className="p-2">{asset.status}</td>
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <EditIconButton onClick={() => openModal(asset)} />
                      <DeleteIconButton onClick={() => handleDelete(asset.id)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sortedAssets.length > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <div className="text-xs text-slate-300/70">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedAssets.length)} of{" "}
            {sortedAssets.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <div className="text-xs text-slate-200">
              Page {page} / {totalPages}
            </div>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">{editAsset ? "Edit Asset" : "Add Asset"}</h3>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <input
                className="input w-full"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />

              <select
                className="input w-full"
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              >
                <option value="">Select Project (optional)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              {form.project_id ? (
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                  {selectedProjectCrs
                    ? `Working CRS: ${selectedProjectCrs.name} (${selectedProjectCrs.code})`
                    : selectedProject?.coordinate_crs_code || selectedProject?.coordinate_crs_name
                      ? `Working CRS: ${selectedProject.coordinate_crs_name || selectedProject.coordinate_crs_code}`
                      : "Working CRS: Not set on project yet"}
                </div>
              ) : null}

              {form.easting !== "" && form.northing !== "" && form.longitude === "" && form.latitude === "" && selectedProjectCrs ? (
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100/85">
                  Longitude and latitude will be calculated from the selected project CRS when you save.
                </div>
              ) : null}

              <select
                className="input w-full"
                value={form.asset_type_id}
                onChange={(e) => setForm((f) => ({ ...f, asset_type_id: e.target.value }))}
                required
              >
                <option value="">Select Asset Type</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>

              <select
                className="input w-full"
                value={form.location_id}
                onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
                required
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>

              <select
                className="input w-full"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">Coordinates</div>
                  <div className="mt-1 text-xs text-slate-300/70">
                    Enter projected easting and northing against a project, or provide longitude and latitude for later mapping.
                  </div>
                  <div className="mt-1 text-xs text-slate-400/80">
                    Easting and northing must be entered together and tied to the selected project CRS.
                  </div>
                  <div className="mt-1 text-xs text-cyan-200/80">
                    When projected coordinates are entered, longitude and latitude will be calculated automatically on save.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    className="input w-full"
                    type="number"
                    step="0.001"
                    placeholder="Easting"
                    value={form.easting}
                    onChange={(e) => setForm((f) => ({ ...f, easting: e.target.value }))}
                  />

                  <input
                    className="input w-full"
                    type="number"
                    step="0.001"
                    placeholder="Northing"
                    value={form.northing}
                    onChange={(e) => setForm((f) => ({ ...f, northing: e.target.value }))}
                  />

                  <input
                    className="input w-full"
                    type="number"
                    step="0.000001"
                    placeholder="Longitude"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  />

                  <input
                    className="input w-full"
                    type="number"
                    step="0.000001"
                    placeholder="Latitude"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  />
                </div>

                <select
                  className="input w-full"
                  value={form.coordinate_source}
                  onChange={(e) => setForm((f) => ({ ...f, coordinate_source: e.target.value }))}
                >
                  <option value="manual">Manual</option>
                  <option value="gps">GPS</option>
                  <option value="survey">Survey</option>
                  <option value="imported">Imported</option>
                  <option value="estimated">Estimated</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}