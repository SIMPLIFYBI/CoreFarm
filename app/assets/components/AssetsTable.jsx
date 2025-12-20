// filepath: c:\Users\james\supa-CoreYard\supa-coreyard\app\assets\components\AssetsTable.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function AssetsTable({
  TABLE_HEAD_ROW,
  TABLE_ROW,
  title = "Assets",
  addButtonLabel = "Add Asset",
}) {
  const PAGE_SIZE = 30;

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // pagination + sorting
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "name", dir: "asc" }); // key: name|type|location|status

  const [showModal, setShowModal] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [form, setForm] = useState({ name: "", asset_type_id: "", location_id: "", status: "Active" });
  const [locations, setLocations] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    setLoading(true);

    Promise.all([
      supabase
        .from("assets")
        .select("id, name, asset_type_id, location_id, status, asset_types(name), asset_locations(name)"),
      supabase.from("asset_locations").select("id, name"),
      supabase.from("asset_types").select("id, name"),
    ]).then(([assetsRes, locRes, typesRes]) => {
      setAssets(assetsRes.data || []);
      setLocations(locRes.data || []);
      setAssetTypes(typesRes.data || []);
      setLoading(false);
    });
  }, [showModal]);

  // keep page valid if data size changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((assets?.length || 0) / PAGE_SIZE));
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [assets, PAGE_SIZE]);

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
    const arr = [...(assets || [])];

    arr.sort((a, b) => {
      const av = getSortValue(a, sort.key);
      const bv = getSortValue(b, sort.key);

      // string compare (case-insensitive)
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();

      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });

    return arr;
  }, [assets, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((sortedAssets?.length || 0) / PAGE_SIZE)),
    [sortedAssets, PAGE_SIZE]
  );

  const pagedAssets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedAssets.slice(start, start + PAGE_SIZE);
  }, [sortedAssets, page, PAGE_SIZE]);

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
            name: asset.name,
            asset_type_id: asset.asset_type_id || "",
            location_id: asset.location_id,
            status: asset.status,
          }
        : { name: "", asset_type_id: "", location_id: "", status: "Active" }
    );
    setShowModal(true);
  };

  const handleSave = async () => {
    const supabase = supabaseBrowser();
    if (editAsset) {
      await supabase.from("assets").update(form).eq("id", editAsset.id);
    } else {
      await supabase.from("assets").insert([form]);
    }
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    const supabase = supabaseBrowser();
    await supabase.from("assets").delete().eq("id", id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <button className="btn btn-primary" onClick={() => openModal()} type="button">
          {addButtonLabel}
        </button>
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
                <td colSpan={5} className="p-4 text-center text-slate-300/70">
                  Loading...
                </td>
              </tr>
            ) : pagedAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-300/70">
                  No assets found.
                </td>
              </tr>
            ) : (
              pagedAssets.map((asset) => (
                <tr key={asset.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{asset.name}</td>
                  <td className="p-2">{asset.asset_types?.name || "-"}</td>
                  <td className="p-2">{asset.asset_locations?.name || "-"}</td>
                  <td className="p-2">{asset.status}</td>
                  <td className="p-2 text-right">
                    <button className="btn btn-xs" onClick={() => openModal(asset)} type="button">
                      Edit
                    </button>
                    <button
                      className="btn btn-xs btn-danger ml-2"
                      onClick={() => handleDelete(asset.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}