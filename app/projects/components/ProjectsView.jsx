"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import ProjectsTable from "./ProjectsTable";
import TenementsTable from "./TenementsTable";
import ProjectModal from "./ProjectModal";
import TenementModal from "./TenementModal";
import LocationsTable from "./LocationsTable";
import ResourcesTable from "./ResourcesTable";
import ResourceModal from "./ResourceModal";
import VendorsTab from "./VendorsTab";

export default function ProjectsView() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const { orgId } = useOrg();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: "", start_date: "", finish_date: "", cost_code: "", wbs_code: "" };
  const [form, setForm] = useState(emptyForm);

  const [activeTab, setActiveTab] = useState("projects"); // "projects" | "tenements" | "locations" | "resources" | "vendors"

  // --- Tenements state ---
  const [tenements, setTenements] = useState([]);
  const [tenementsLoading, setTenementsLoading] = useState(false);
  const [showTenementModal, setShowTenementModal] = useState(false);
  const [savingTenement, setSavingTenement] = useState(false);
  const [editingTenementId, setEditingTenementId] = useState(null);

  const tenementEmptyForm = {
    tenement_number: "",
    tenement_type: "",
    application_number: "",
    status: "",
    date_applied: "",
    date_granted: "",
    renewal_date: "",
    expenditure_commitment: "",
    heritage_agreements: "",
  };
  const [tenementForm, setTenementForm] = useState(tenementEmptyForm);

  // --- Resources state ---
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);

  // resources form should include vendor_id
  const resourceEmptyForm = { name: "", resource_type: "Other", description: "", vendor_id: "" };
  const [resourceForm, setResourceForm] = useState(resourceEmptyForm);

  // add vendors state for the dropdown
  const [vendors, setVendors] = useState([]);

  const TABLE_HEAD_ROW = "text-left bg-slate-900/40 text-slate-200 border-b border-white/10";
  const TABLE_ROW = "border-b border-white/10 last:border-b-0 hover:bg-white/5";

  // Load projects
  useEffect(() => {
    if (!orgId) {
      setProjects([]);
      return;
    }

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,start_date,finish_date,cost_code,wbs_code,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      setProjects(!error ? data || [] : []);
      setLoading(false);
    })();
  }, [orgId, supabase]);

  // Load tenements when tab becomes active
  useEffect(() => {
    if (activeTab !== "tenements") return;

    if (!orgId) {
      setTenements([]);
      return;
    }

    (async () => {
      setTenementsLoading(true);
      const { data, error } = await supabase
        .from("tenements")
        .select(
          "id,tenement_number,tenement_type,application_number,status,date_applied,date_granted,renewal_date,expenditure_commitment,heritage_agreements,created_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      setTenements(!error ? data || [] : []);
      setTenementsLoading(false);
    })();
  }, [orgId, supabase, activeTab]);

  // load vendors when org is available (or when resources tab is active)
  useEffect(() => {
    if (!orgId) {
      setVendors([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id,name")
        .eq("organization_id", orgId)
        .order("name");

      if (error) {
        console.error("Failed to load vendors:", error);
        setVendors([]);
        return;
      }

      setVendors(data || []);
    })();
  }, [orgId, supabase]);

  // Load resources (include vendor)
  useEffect(() => {
    if (activeTab !== "resources") return;

    if (!orgId) {
      setResources([]);
      return;
    }

    (async () => {
      setResourcesLoading(true);

      const { data, error } = await supabase
        .from("resources")
        .select(`
          id,
          name,
          description,
          resource_type,
          vendor_id,
          vendor:vendors!resources_vendor_fk (
            id,
            name
          ),
          created_at
        `)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load resources:", error);
        setResources([]);
      } else {
        setResources(data || []);
      }

      setResourcesLoading(false);
    })();
  }, [orgId, supabase, activeTab]);

  // --- Project handlers ---
  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      start_date: p.start_date || "",
      finish_date: p.finish_date || "",
      cost_code: p.cost_code || "",
      wbs_code: p.wbs_code || "",
    });
    setShowModal(true);
  };

  const saveProject = async () => {
    if (!orgId) return;
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        start_date: form.start_date || null,
        finish_date: form.finish_date || null,
        cost_code: form.cost_code || null,
        wbs_code: form.wbs_code || null,
        organization_id: orgId,
      };

      let res;
      if (editingId) {
        const { organization_id, ...updateFields } = payload;
        res = await supabase.from("projects").update(updateFields).eq("id", editingId).select().single();
      } else {
        res = await supabase.from("projects").insert(payload).select().single();
      }
      if (res.error) throw res.error;

      const { data } = await supabase
        .from("projects")
        .select("id,name,start_date,finish_date,cost_code,wbs_code,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      setProjects(data || []);
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (p) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    await supabase.from("projects").delete().eq("id", p.id);
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
  };

  // --- Tenement handlers ---
  const openNewTenement = () => {
    setEditingTenementId(null);
    setTenementForm(tenementEmptyForm);
    setShowTenementModal(true);
  };

  const openEditTenement = (t) => {
    setEditingTenementId(t.id);
    setTenementForm({
      tenement_number: t.tenement_number || "",
      tenement_type: t.tenement_type || "",
      application_number: t.application_number || "",
      status: t.status || "",
      date_applied: t.date_applied || "",
      date_granted: t.date_granted || "",
      renewal_date: t.renewal_date || "",
      expenditure_commitment: t.expenditure_commitment || "",
      heritage_agreements: t.heritage_agreements || "",
    });
    setShowTenementModal(true);
  };

  const saveTenement = async () => {
    if (!orgId) return;
    if (!tenementForm.tenement_number.trim()) return;

    setSavingTenement(true);
    try {
      const payload = {
        tenement_number: tenementForm.tenement_number.trim(),
        tenement_type: tenementForm.tenement_type || null,
        application_number: tenementForm.application_number || null,
        status: tenementForm.status || null,
        date_applied: tenementForm.date_applied || null,
        date_granted: tenementForm.date_granted || null,
        renewal_date: tenementForm.renewal_date || null,
        expenditure_commitment: tenementForm.expenditure_commitment || null,
        heritage_agreements: tenementForm.heritage_agreements || null,
        organization_id: orgId,
      };

      let res;
      if (editingTenementId) {
        const { organization_id, ...updateFields } = payload;
        res = await supabase.from("tenements").update(updateFields).eq("id", editingTenementId).select().single();
      } else {
        res = await supabase.from("tenements").insert(payload).select().single();
      }
      if (res.error) throw res.error;

      const { data } = await supabase
        .from("tenements")
        .select(
          "id,tenement_number,tenement_type,application_number,status,date_applied,date_granted,renewal_date,expenditure_commitment,heritage_agreements,created_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      setTenements(data || []);
      setShowTenementModal(false);
      setEditingTenementId(null);
      setTenementForm(tenementEmptyForm);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTenement(false);
    }
  };

  const deleteTenement = async (t) => {
    if (!confirm(`Delete tenement "${t.tenement_number}"?`)) return;
    await supabase.from("tenements").delete().eq("id", t.id);
    setTenements((prev) => prev.filter((x) => x.id !== t.id));
  };

  // --- Resource handlers ---
  const openNewResource = () => {
    setEditingResourceId(null);
    setResourceForm(resourceEmptyForm);
    setShowResourceModal(true);
  };

  const openEditResource = (r) => {
    setEditingResourceId(r.id);
    setResourceForm({
      name: r.name || "",
      resource_type: r.resource_type || "Other",
      description: r.description || "",
      vendor_id: r.vendor_id || "",
    });
    setShowResourceModal(true);
  };

  const saveResource = async () => {
    if (!orgId) return;
    if (!resourceForm.name.trim()) return;

    setSavingResource(true);
    try {
      const payload = {
        name: resourceForm.name.trim(),
        resource_type: resourceForm.resource_type || "Other",
        description: resourceForm.description?.trim() ? resourceForm.description.trim() : null,
        vendor_id: resourceForm.vendor_id || null, // optional FK
        organization_id: orgId,
      };

      let res;
      if (editingResourceId) {
        const { organization_id, ...updateFields } = payload;
        res = await supabase.from("resources").update(updateFields).eq("id", editingResourceId).select().single();
      } else {
        res = await supabase.from("resources").insert(payload).select().single();
      }
      if (res.error) throw res.error;

      const { data } = await supabase
        .from("resources")
        .select(`
          id,
          name,
          description,
          resource_type,
          vendor_id,
          vendor:vendors!resources_vendor_fk (
            id,
            name
          ),
          created_at
        `)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      setResources(data || []);
      setShowResourceModal(false);
      setEditingResourceId(null);
      setResourceForm(resourceEmptyForm);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to save resource");
    } finally {
      setSavingResource(false);
    }
  };

  const deleteResource = async (r) => {
    if (!confirm(`Delete resource "${r.name}"?`)) return;
    await supabase.from("resources").delete().eq("id", r.id);
    setResources((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Projects</h1>

      <div className="mb-6 flex gap-2 border-b border-white/10">
        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "projects" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("projects")}
          type="button"
        >
          Projects
        </button>

        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "tenements" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("tenements")}
          type="button"
        >
          Tenements
        </button>

        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "locations" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("locations")}
          type="button"
        >
          Locations
        </button>

        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "resources" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("resources")}
          type="button"
        >
          Resources
        </button>

        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "vendors"
              ? "border-b-2 border-indigo-500 text-indigo-300"
              : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("vendors")}
          type="button"
        >
          Vendors
        </button>
      </div>

      {/* header actions per tab */}
      {activeTab === "projects" && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="text-sm text-slate-300/70">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </div>
          <button onClick={openNew} className="btn btn-primary" type="button">
            New Project
          </button>
        </div>
      )}

      {activeTab === "tenements" && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="text-sm text-slate-300/70">
            {tenements.length} tenement{tenements.length === 1 ? "" : "s"}
          </div>
          <button onClick={openNewTenement} className="btn btn-primary" type="button">
            New Tenement
          </button>
        </div>
      )}

      {activeTab === "resources" && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="text-sm text-slate-300/70">
            {resources.length} resource{resources.length === 1 ? "" : "s"}
          </div>
          <button onClick={openNewResource} className="btn btn-primary" type="button">
            New Resource
          </button>
        </div>
      )}

      {activeTab === "projects" && (
        <ProjectsTable loading={loading} projects={projects} onEdit={openEdit} onDelete={deleteProject} />
      )}

      {activeTab === "tenements" && (
        <TenementsTable
          loading={tenementsLoading}
          tenements={tenements}
          onEdit={openEditTenement}
          onDelete={deleteTenement}
        />
      )}

      {activeTab === "locations" && <LocationsTable TABLE_HEAD_ROW={TABLE_HEAD_ROW} TABLE_ROW={TABLE_ROW} />}

      {activeTab === "resources" && (
        <ResourcesTable
          loading={resourcesLoading}
          resources={resources}
          onEdit={openEditResource}
          onDelete={deleteResource}
          TABLE_HEAD_ROW={TABLE_HEAD_ROW}
          TABLE_ROW={TABLE_ROW}
        />
      )}

      {activeTab === "vendors" && (
        <VendorsTab
          orgId={orgId}
          TABLE_HEAD_ROW={TABLE_HEAD_ROW}
          TABLE_ROW={TABLE_ROW}
        />
      )}

      {showModal && (
        <ProjectModal
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => {
            setShowModal(false);
            setEditingId(null);
          }}
          onSave={saveProject}
          onNew={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
        />
      )}

      {showTenementModal && (
        <TenementModal
          editingId={editingTenementId}
          form={tenementForm}
          setForm={setTenementForm}
          saving={savingTenement}
          onClose={() => {
            setShowTenementModal(false);
            setEditingTenementId(null);
          }}
          onSave={saveTenement}
          onNew={() => {
            setEditingTenementId(null);
            setTenementForm(tenementEmptyForm);
          }}
        />
      )}

      {showResourceModal && (
        <ResourceModal
          editingId={editingResourceId}
          form={resourceForm}
          setForm={setResourceForm}
          saving={savingResource}
          vendors={vendors}
          onClose={() => {
            setShowResourceModal(false);
            setEditingResourceId(null);
          }}
          onSave={saveResource}
          onNew={() => {
            setEditingResourceId(null);
            setResourceForm(resourceEmptyForm);
          }}
        />
      )}
    </div>
  );
}