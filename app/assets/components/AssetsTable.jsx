// filepath: c:\Users\james\supa-CoreYard\supa-coreyard\app\assets\components\AssetsTable.jsx
"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function AssetsTable({
  TABLE_HEAD_ROW,
  TABLE_ROW,
  title = "Assets",
  addButtonLabel = "Add Asset",
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
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
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Location</th>
              <th className="p-2 font-medium">Status</th>
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
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-300/70">
                  No assets found.
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{asset.name}</td>
                  <td className="p-2">{asset.asset_types?.name || "-"}</td>
                  <td className="p-2">{asset.asset_locations?.name || "-"}</td>
                  <td className="p-2">{asset.status}</td>
                  <td className="p-2 text-right">
                    <button className="btn btn-xs" onClick={() => openModal(asset)} type="button">
                      Edit
                    </button>
                    <button className="btn btn-xs btn-danger ml-2" onClick={() => handleDelete(asset.id)} type="button">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">
              {editAsset ? "Edit Asset" : "Add Asset"}
            </h3>

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