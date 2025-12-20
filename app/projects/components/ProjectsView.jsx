"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import ProjectsTable from "./ProjectsTable";
import TenementsTable from "./TenementsTable";
import ProjectModal from "./ProjectModal";
import TenementModal from "./TenementModal";

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

  // --- Tenements state ---
  const [activeTab, setActiveTab] = useState("projects"); // "projects" | "tenements"
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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Projects</h1>

      {/* top tab bar */}
      <div className="mb-6 flex gap-2 border-b border-white/10">
        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "projects" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("projects")}
        >
          Projects
        </button>
        <button
          className={`px-4 py-2 -mb-px font-medium text-sm ${
            activeTab === "tenements" ? "border-b-2 border-indigo-500 text-indigo-300" : "text-slate-300/70"
          }`}
          onClick={() => setActiveTab("tenements")}
        >
          Tenements
        </button>
      </div>

      {/* header actions per tab */}
      {activeTab === "projects" && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="text-sm text-slate-300/70">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </div>
          <button onClick={openNew} className="btn btn-primary">
            New Project
          </button>
        </div>
      )}

      {activeTab === "tenements" && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="text-sm text-slate-300/70">
            {tenements.length} tenement{tenements.length === 1 ? "" : "s"}
          </div>
          <button onClick={openNewTenement} className="btn btn-primary">
            New Tenement
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
    </div>
  );
}