"use client";

import React, { useEffect, useState } from "react";
import { IconPlods } from "../components/icons";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { AdminPanel } from "./components/AdminPanel";
import { HistoryTable } from "./components/HistoryTable";
import { PlodCreateSheet } from "./components/PlodCreateSheet";

export default function Page() {
  const supabase = supabaseBrowser();
  const { orgId: selectedOrgId, loading: orgLoading } = useOrg();

  const [vendors, setVendors] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [holes, setHoles] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [vendorForm, setVendorForm] = useState({ name: "", contact: "", organization_id: "" });
  const [vendorLoading, setVendorLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [enteredBy, setEnteredBy] = useState("");
  const [showCreatePlod, setShowCreatePlod] = useState(false);
  const [activityTypeForm, setActivityTypeForm] = useState({
    activityType: "",
    group: "",
    description: "",
    organization_id: "",
  });
  const [activityTypeLoading, setActivityTypeLoading] = useState(false);
  const [plods, setPlods] = useState([]);
  const [plodsLoading, setPlodsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [vendorResources, setVendorResources] = useState([]);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [resourceForm, setResourceForm] = useState({
    vendor_id: "",
    name: "",
    resource_type: "",
    status: "Active",
    notes: "",
  });
  const [resourceLoading, setResourceLoading] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);

  useEffect(() => {
    const sb = supabase;

    // enteredBy
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;

      const { data } = await sb.from("profiles").select("full_name,email").eq("id", user.id).single();
      const name = data?.full_name || data?.email || user.email || "";
      setEnteredBy(name);
    })();

    // org-scoped data
    const vQuery = sb.from("vendors").select("id,name").limit(100);
    const aQuery = sb
      .from("plod_activity_types")
      .select('id,activity_type,"group",description')
      .limit(200);
    const hQuery = sb.from("holes").select("id,hole_id").limit(200);

    if (selectedOrgId) {
      vQuery.eq("organization_id", selectedOrgId);
      aQuery.eq("organization_id", selectedOrgId);
      hQuery.eq("organization_id", selectedOrgId);
    }

    Promise.all([vQuery, aQuery, hQuery]).then(([vRes, aRes, hRes]) => {
      if (vRes?.error) setMessage({ type: "error", text: vRes.error.message });
      else setVendors(vRes?.data || []);
      if (aRes?.error) setMessage({ type: "error", text: aRes.error.message });
      else setActivityTypes(aRes?.data || []);
      if (hRes?.error) setMessage({ type: "error", text: hRes.error.message });
      else setHoles(hRes?.data || []);
    });

    if (activeTab === "home" && selectedOrgId) {
      loadPlods();
    }
  }, [selectedOrgId, activeTab, expandedVendor]);

  const loadPlods = async () => {
    if (!selectedOrgId) return;

    setPlodsLoading(true);
    const sb = supabase;

    try {
      const { data, error } = await sb
        .from("plods")
        .select(`
          id,
          plod_type,
          started_at,
          finished_at,
          notes,
          vendors:vendor_id(name),
          plod_activities(
            id,
            activity_type_id,
            hole_id,
            started_at,
            finished_at,
            notes,
            activity_types:activity_type_id(activity_type),
            holes:hole_id(hole_id)
          )
        `)
        .eq("organization_id", selectedOrgId)
        .gte("started_at", dateRange.from ? `${dateRange.from}T00:00:00` : null)
        .lte("started_at", dateRange.to ? `${dateRange.to}T23:59:59` : null)
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) setMessage({ type: "error", text: error.message });
      else setPlods(data || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load plods history" });
    } finally {
      setPlodsLoading(false);
    }
  };

  const handleVendorChange = (k) => (e) => setVendorForm((s) => ({ ...s, [k]: e.target.value }));
  const handleActivityTypeChange = (k) => (e) => setActivityTypeForm((s) => ({ ...s, [k]: e.target.value }));

  const loadVendors = async () => {
    if (!selectedOrgId) return;
    const sb = supabase;
    const { data, error } = await sb.from("vendors").select("*").eq("organization_id", selectedOrgId).order("name");
    if (error) setMessage({ type: "error", text: `Failed to load vendors: ${error.message}` });
    else setVendors(data || []);
  };

  const submitVendor = async (e) => {
    e.preventDefault();
    setVendorLoading(true);
    setMessage(null);

    if (!vendorForm.name) {
      setMessage({ type: "error", text: "Please provide a vendor name." });
      setVendorLoading(false);
      return;
    }
    if (!selectedOrgId) {
      setMessage({ type: "error", text: "Organization ID is missing." });
      setVendorLoading(false);
      return;
    }

    try {
      const sb = supabase;
      const payload = { name: vendorForm.name, contact: vendorForm.contact, organization_id: selectedOrgId };
      const { error } = await sb.from("vendors").insert(payload);
      if (error) throw error;

      await loadVendors();
      setMessage({ type: "success", text: "Vendor added successfully." });
      setVendorForm({ name: "", contact: "", organization_id: "" });
    } catch (error) {
      setMessage({ type: "error", text: `Failed to add vendor: ${error.message}` });
    } finally {
      setVendorLoading(false);
    }
  };

  const refreshActivityTypes = async () => {
    const sb = supabase;
    const query = sb
      .from("plod_activity_types")
      .select('id,activity_type,"group",description,plod_type_scope')
      .limit(200);

    if (selectedOrgId) query.eq("organization_id", selectedOrgId);

    const { data, error } = await query;
    if (error) setMessage({ type: "error", text: error.message });
    else setActivityTypes(data || []);
  };

  const submitActivityType = async (e) => {
    e.preventDefault();
    setActivityTypeLoading(true);
    setMessage(null);

    if (!activityTypeForm.activityType) {
      setMessage({ type: "error", text: "Please provide an activity type." });
      setActivityTypeLoading(false);
      return;
    }
    if (!selectedOrgId) {
      setMessage({ type: "error", text: "Please select an organization first." });
      setActivityTypeLoading(false);
      return;
    }

    try {
      const sb = supabase;
      const payload = {
        organization_id: selectedOrgId,
        activity_type: activityTypeForm.activityType,
        group: activityTypeForm.group || null,
        description: activityTypeForm.description || null,
      };
      const { error } = await sb.from("plod_activity_types").insert(payload);
      if (error) throw error;

      setMessage({ type: "success", text: "Activity type added." });
      setActivityTypeForm((s) => ({ ...s, activityType: "", group: "", description: "" }));
      await refreshActivityTypes();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActivityTypeLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedOrgId) return;

    (async () => {
      const { data, error } = await supabase
        .from("plod_activity_types")
        .select("id, activity_type, description, group, label, plod_type_scope")
        .eq("organization_id", selectedOrgId)
        .order("activity_type", { ascending: true });

      if (error) {
        console.error("load plod_activity_types error", error);
        setActivityTypes([]);
        return;
      }

      setActivityTypes(data || []);
    })();
  }, [selectedOrgId, supabase]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
              <IconPlods />
            </span>
            Plods
          </h1>
          <p className="text-sm text-slate-300 mt-2">
            Record a shift. Choose plod type, fill header fields, then add activities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreatePlod(true)}
          className="btn btn-primary whitespace-nowrap"
        >
          New Plod
        </button>
      </header>

      <div className="card overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            className={`px-4 py-3 -mb-px text-sm font-medium transition-base ${activeTab === "home" ? "border-b-2 border-indigo-400 text-slate-100" : "text-slate-300 hover:text-slate-100"}`}
            onClick={() => {
              setActiveTab("home");
              if (selectedOrgId) loadPlods();
            }}
          >
            Home
          </button>
          <button
            className={`px-4 py-3 -mb-px text-sm font-medium transition-base ${activeTab === "admin" ? "border-b-2 border-indigo-400 text-slate-100" : "text-slate-300 hover:text-slate-100"}`}
            onClick={() => setActiveTab("admin")}
          >
            Admin
          </button>
        </div>

        <section className="p-6">
          {message && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                message.type === "error"
                  ? "bg-red-500/10 text-red-200 border-red-500/20"
                  : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === "admin" && (
            <AdminPanel
              vendors={vendors}
              vendorForm={vendorForm}
              vendorLoading={vendorLoading}
              handleVendorChange={handleVendorChange}
              submitVendor={submitVendor}
              activityTypes={activityTypes}
              activityTypeForm={activityTypeForm}
              activityTypeLoading={activityTypeLoading}
              handleActivityTypeChange={handleActivityTypeChange}
              submitActivityType={submitActivityType}
              orgId={selectedOrgId}
              orgLoading={orgLoading}
              setActivityTypes={setActivityTypes}
            />
          )}

          {activeTab === "home" && (
            <HistoryTable
              plods={plods}
              plodsLoading={plodsLoading}
              dateRange={dateRange}
              onDateChange={(k, v) => setDateRange((s) => ({ ...s, [k]: v }))}
              onRefresh={loadPlods}
            />
          )}
        </section>
      </div>

      {/* Create sheet */}
      <PlodCreateSheet
        open={showCreatePlod}
        onClose={() => setShowCreatePlod(false)}
        orgId={selectedOrgId}
        enteredBy={enteredBy}
        vendors={vendors}
        holes={holes}
        activityTypes={activityTypes}
        onCreated={loadPlods}
      />

      {/* ...existing Resource Modal remains unchanged... */}
    </div>
  );
}
