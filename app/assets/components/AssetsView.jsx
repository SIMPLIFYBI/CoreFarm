"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { AssetIcon } from "@/app/components/icons";

import ActivityTypesTab from "../ActivityTypesTab";
import AssetsTable from "./AssetsTable";
import HistoryTable from "./HistoryTable";

const TABS = [
  { key: "assets", label: "Assets" },
  { key: "history", label: "History" },
  // If you want this visible as a tab, uncomment:
  // { key: "activity-types", label: "Activity Types" },
];

const TAB_BASE =
  "px-4 py-2 font-medium text-sm rounded-t-md transition-colors border border-transparent";
const TAB_ACTIVE =
  "text-indigo-300 border-white/10 border-b-transparent bg-slate-900/40";
const TAB_INACTIVE =
  "text-slate-300/70 hover:text-slate-200 hover:bg-white/5";

const TABLE_HEAD_ROW =
  "text-left bg-slate-900/40 text-slate-200 border-b border-white/10";
const TABLE_ROW =
  "border-b border-white/10 last:border-b-0 hover:bg-white/5";

export default function AssetsView() {
  const [activeTab, setActiveTab] = useState("assets");
  const { orgId } = useOrg();
  const [summary, setSummary] = useState({
    totalAssets: 0,
    activeAssets: 0,
    locationCount: 0,
    typeCount: 0,
  });

  // Keeping this block as-is (it exists in your current file),
  // even though it isn't rendered yet.
  const [vendors, setVendors] = useState([]);
  const [vendorForm, setVendorForm] = useState({ name: "", contact: "" });
  const [vendorLoading, setVendorLoading] = useState(false);
  const [message, setMessage] = useState(null);

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

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (!orgId) {
        if (!mounted) return;
        setSummary({ totalAssets: 0, activeAssets: 0, locationCount: 0, typeCount: 0 });
        return;
      }

      try {
        const sb = supabaseBrowser();
        const [assetsRes, locationsRes, typesRes] = await Promise.all([
          sb.from("assets").select("id,status").eq("organization_id", orgId),
          sb.from("asset_locations").select("id").eq("organization_id", orgId),
          sb.from("asset_types").select("id"),
        ]);

        if (!mounted) return;

        const assetRows = assetsRes.data || [];
        setSummary({
          totalAssets: assetRows.length,
          activeAssets: assetRows.filter((asset) => String(asset.status || "").toLowerCase() === "active").length,
          locationCount: (locationsRes.data || []).length,
          typeCount: (typesRes.data || []).length,
        });
      } catch {
        if (!mounted) return;
        setSummary({ totalAssets: 0, activeAssets: 0, locationCount: 0, typeCount: 0 });
      }
    }

    void loadSummary();
    return () => {
      mounted = false;
    };
  }, [orgId, activeTab]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <section className="card p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,rgba(8,145,178,0.9),rgba(30,41,59,0.95))] text-white shadow-[0_20px_50px_rgba(8,145,178,0.18)]">
            <AssetIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Assets</h1>
            <p className="mt-1 text-sm text-slate-300">
              Central place to manage registered equipment, locations, and change history across the organization.
            </p>
          </div>
        </div>
      </section>

      <section className="glass overflow-hidden rounded-2xl border border-white/10 p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${TAB_BASE} ${activeTab === tab.key ? TAB_ACTIVE : TAB_INACTIVE}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Registered Assets</div>
          <div className="text-2xl font-semibold text-slate-100">{summary.totalAssets}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Active Assets</div>
          <div className="text-2xl font-semibold text-slate-100">{summary.activeAssets}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Locations</div>
          <div className="text-2xl font-semibold text-slate-100">{summary.locationCount}</div>
        </div>
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="text-xs text-slate-300">Asset Types</div>
          <div className="text-2xl font-semibold text-slate-100">{summary.typeCount}</div>
        </div>
      </section>

      <section className="card overflow-hidden p-4 md:p-5">
        {activeTab === "assets" && (
          <AssetsTable TABLE_HEAD_ROW={TABLE_HEAD_ROW} TABLE_ROW={TABLE_ROW} />
        )}
        {activeTab === "history" && (
          <HistoryTable TABLE_HEAD_ROW={TABLE_HEAD_ROW} TABLE_ROW={TABLE_ROW} embedded />
        )}
        {activeTab === "activity-types" && <ActivityTypesTab />}
      </section>
    </div>
  );
}