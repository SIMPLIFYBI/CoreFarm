"use client";
import React, { useState, useEffect } from "react";
import { supabaseBrowser } from "../../lib/supabaseClient";
import { Fragment } from "react";
import ActivityTypesTab from "./ActivityTypesTab";
import { useOrg } from "../../lib/OrgContext";
import { AssetIcon } from "../components/icons";

const TABS = [
  { key: "assets", label: "Assets" },
  { key: "locations", label: "Locations" },
  { key: "history", label: "History" },
];

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState("assets");
  // org context + vendor state (moved here so hooks/state are available)
  const { orgId } = useOrg();
  const [vendors, setVendors] = useState([]);
  const [vendorForm, setVendorForm] = useState({ name: "", contact: "" });
  const [vendorLoading, setVendorLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // load vendors (filtered by org) - can be called when needed
  const loadVendors = async () => {
    if (!orgId) return setVendors([]);
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("vendors")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      setVendors(data || []);
    } catch (err) {
      console.error("Error loading vendors:", err);
      setMessage({ type: "error", text: `Failed to load vendors: ${err.message}` });
    }
  };

  const submitVendor = async (e) => {
    e && e.preventDefault();
    setVendorLoading(true);
    setMessage(null);
    if (!vendorForm.name) {
      setMessage({ type: "error", text: "Please provide a vendor name." });
      setVendorLoading(false);
      return;
    }
    if (!orgId) {
      setMessage({ type: "error", text: "Organization ID is missing." });
      setVendorLoading(false);
      return;
    }
    try {
      const sb = supabaseBrowser();
      const payload = { name: vendorForm.name, contact: vendorForm.contact, organization_id: orgId };
      const { error } = await sb.from("vendors").insert(payload);
      if (error) throw error;
      await loadVendors();
      setMessage({ type: "success", text: "Vendor added successfully." });
      setVendorForm({ name: "", contact: "" });
    } catch (err) {
      console.error("Error saving vendor:", err);
      setMessage({ type: "error", text: `Failed to add vendor: ${err.message}` });
    } finally {
      setVendorLoading(false);
    }
  };
  // optionally load vendors when assets tab mounts
  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm">
          <AssetIcon className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold text-gray-800">Assets</h1>
      </div>
      <div className="flex gap-2 border-b mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-2 font-medium rounded-t-md transition-colors ${activeTab === tab.key ? "bg-white text-indigo-600 border-x border-t border-indigo-200" : "bg-indigo-50 text-gray-600 hover:text-indigo-700"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* main content rendered once below (removed duplicate AssetsTable block) */}
      <div className="mt-4">
        {activeTab === "assets" && <AssetsTable />}
        {activeTab === "locations" && <LocationsTable />}
        {activeTab === "history" && <HistoryTable />}
        {activeTab === "activity-types" && <ActivityTypesTab />}
      </div>
    </div>
  );
}

function AssetsTable() {
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
      supabase.from("assets").select("id, name, asset_type_id, location_id, status, asset_types(name), asset_locations(name)"),
      supabase.from("asset_locations").select("id, name"),
      supabase.from("asset_types").select("id, name")
    ]).then(([assetsRes, locRes, typesRes]) => {
      setAssets(assetsRes.data || []);
      setLocations(locRes.data || []);
      setAssetTypes(typesRes.data || []);
      setLoading(false);
    });
  }, [showModal]);

  const openModal = (asset = null) => {
    setEditAsset(asset);
    setForm(asset ? {
      name: asset.name,
      asset_type_id: asset.asset_type_id || "",
      location_id: asset.location_id,
      status: asset.status
    } : { name: "", asset_type_id: "", location_id: "", status: "Active" });
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
    setAssets(assets.filter(a => a.id !== id));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Assets</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>Add Asset</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-indigo-50">
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4">No assets found.</td></tr>
            ) : (
              assets.map(asset => (
                <tr key={asset.id}>
                  <td className="px-3 py-2">{asset.name}</td>
                  <td className="px-3 py-2">{asset.asset_types?.name || "-"}</td>
                  <td className="px-3 py-2">{asset.asset_locations?.name || "-"}</td>
                  <td className="px-3 py-2">{asset.status}</td>
                  <td className="px-3 py-2">
                    <button className="btn btn-xs" onClick={() => openModal(asset)}>Edit</button>
                    <button className="btn btn-xs btn-danger ml-2" onClick={() => handleDelete(asset.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editAsset ? "Edit Asset" : "Add Asset"}</h3>
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <select className="w-full border rounded px-3 py-2" value={form.asset_type_id} onChange={e => setForm(f => ({ ...f, asset_type_id: e.target.value }))} required>
                <option value="">Select Asset Type</option>
                {assetTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <select className="w-full border rounded px-3 py-2" value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} required>
                <option value="">Select Location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <select className="w-full border rounded px-3 py-2" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} required>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationsTable() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  useEffect(() => {
    const supabase = supabaseBrowser();
    setLoading(true);
    supabase
      .from("asset_locations")
      .select("id, name, description")
      .then(({ data }) => {
        setLocations(data || []);
        setLoading(false);
      });
  }, [showModal]);

  const openModal = (loc = null) => {
    setEditLoc(loc);
    setForm(loc ? { name: loc.name, description: loc.description } : { name: "", description: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    const supabase = supabaseBrowser();
    if (editLoc) {
      const res = await supabase.from("asset_locations").update(form).eq("id", editLoc.id).select().single();
      if (res.error) {
        console.error('Failed to update location', res.error);
        alert('Error updating location: ' + res.error.message);
        return;
      }
      setLocations((prev) => prev.map(l => (l.id === res.data.id ? res.data : l)));
      setShowModal(false);
    } else {
      const res = await supabase.from("asset_locations").insert([form]).select().single();
      if (res.error) {
        console.error('Failed to insert location', res.error);
        alert('Error creating location: ' + res.error.message);
        return;
      }
      // Prepend new location to the list for immediate feedback
      setLocations((prev) => [res.data, ...prev]);
      setShowModal(false);
    }
  };

  const handleDelete = async (id) => {
    const supabase = supabaseBrowser();
    const res = await supabase.from("asset_locations").delete().eq("id", id).select();
    if (res.error) {
      console.error('Failed to delete location', res.error);
      alert('Error deleting location: ' + res.error.message);
      return;
    }
    setLocations((prev) => prev.filter(l => l.id !== id));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Locations</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>Add Location</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-indigo-50">
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center py-4">Loading...</td></tr>
            ) : locations.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-4">No locations found.</td></tr>
            ) : (
              locations.map(loc => (
                <tr key={loc.id}>
                  <td className="px-3 py-2">{loc.name}</td>
                  <td className="px-3 py-2">{loc.description}</td>
                  <td className="px-3 py-2">
                    <button className="btn btn-xs" onClick={() => openModal(loc)}>Edit</button>
                    <button className="btn btn-xs btn-danger ml-2" onClick={() => handleDelete(loc.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editLoc ? "Edit Location" : "Add Location"}</h3>
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <input className="w-full border rounded px-3 py-2" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTable() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const supabase = supabaseBrowser();
    setLoading(true);
    supabase
      .from("asset_history")
      .select("id, created_at, asset_id, user_id, action, details, assets(name), users(email)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setHistory(data || []);
        setLoading(false);
      });
  }, []);
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Asset History</h2>
        {/* TODO: Add asset/user filter dropdowns */}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-indigo-50">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Asset</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-4">No history found.</td></tr>
            ) : (
              history.map(row => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.created_at?.slice(0,10)}</td>
                  <td className="px-3 py-2">{row.assets?.name || row.asset_id}</td>
                  <td className="px-3 py-2">{row.users?.email || row.user_id}</td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">{row.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
