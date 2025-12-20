"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import VendorsTable from "./VendorsTable";
import VendorModal from "./VendorModal";

export default function VendorsTab({ orgId, TABLE_HEAD_ROW, TABLE_ROW }) {
  const supabase = supabaseBrowser();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: "", contact: "" };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!orgId) {
      setVendors([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("id,name,contact,created_at")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load vendors:", error);
      setVendors([]);
    } else {
      setVendors(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (v) => {
    setEditingId(v.id);
    setForm({ name: v.name || "", contact: v.contact || "" });
    setShowModal(true);
  };

  const save = async () => {
    if (!orgId) return;
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact?.trim() ? form.contact.trim() : null,
        organization_id: orgId,
      };

      const res = editingId
        ? await supabase
            .from("vendors")
            .update({ name: payload.name, contact: payload.contact })
            .eq("id", editingId)
        : await supabase.from("vendors").insert(payload);

      if (res.error) throw res.error;

      await load();
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e) {
      console.error("Failed to save vendor:", e);
      alert(e?.message || "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;

    const res = await supabase.from("vendors").delete().eq("id", v.id);
    if (res.error) {
      console.error("Failed to delete vendor:", res.error);
      alert(res.error.message || "Failed to delete vendor");
      return;
    }

    // resources.vendor_id is ON DELETE SET NULL, so this is safe
    setVendors((prev) => prev.filter((x) => x.id !== v.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">
          {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
        </div>
        <button onClick={openNew} className="btn btn-primary" type="button">
          New Vendor
        </button>
      </div>

      <VendorsTable
        loading={loading}
        vendors={vendors}
        onEdit={openEdit}
        onDelete={remove}
        TABLE_HEAD_ROW={TABLE_HEAD_ROW}
        TABLE_ROW={TABLE_ROW}
      />

      {showModal && (
        <VendorModal
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => {
            setShowModal(false);
            setEditingId(null);
          }}
          onSave={save}
          onNew={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
        />
      )}
    </div>
  );
}