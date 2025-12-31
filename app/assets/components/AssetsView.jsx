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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm">
          <AssetIcon className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold text-slate-100">Assets</h1>
      </div>

      <div className="flex gap-2 border-b border-white/10 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${TAB_BASE} ${
              activeTab === tab.key ? TAB_ACTIVE : TAB_INACTIVE
            }`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "assets" && (
          <AssetsTable TABLE_HEAD_ROW={TABLE_HEAD_ROW} TABLE_ROW={TABLE_ROW} />
        )}
        {activeTab === "history" && (
          <HistoryTable TABLE_HEAD_ROW={TABLE_HEAD_ROW} TABLE_ROW={TABLE_ROW} />
        )}
        {activeTab === "activity-types" && <ActivityTypesTab />}
      </div>
    </div>
  );
}