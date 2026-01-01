"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function PlodTypeModal({ open, onClose, onSave, saving, form, setForm, isEditing }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-slate-100">{isEditing ? "Edit Plod Type" : "New Plod Type"}</h2>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <label className="block text-sm">
            Name
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Load & Haul"
              required
            />
          </label>

          <label className="block text-sm">
            Description (optional)
            <textarea
              className="input w-full"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Sort order
              <input
                className="input w-full"
                type="number"
                step="1"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>

            <label className="block text-sm">
              Active
              <select
                className="input w-full"
                value={form.is_active ? "yes" : "no"}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "yes" }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlodTypesAdminPanel({ orgId }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(false);
  const [plodTypes, setPlodTypes] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: "", description: "", sort_order: 0, is_active: true };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!orgId) {
      setPlodTypes([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("plod_types")
      .select("id,name,description,sort_order,is_active,created_at")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("load plod_types", error);
      toast.error(error.message || "Failed to load plod types");
      setPlodTypes([]);
    } else {
      setPlodTypes(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      description: row.description || "",
      sort_order: row.sort_order ?? 0,
      is_active: !!row.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!orgId) return toast.error("Organisation not ready");
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        sort_order: toInt(form.sort_order, 0),
        is_active: !!form.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from("plod_types").update(payload).eq("id", editingId).eq("organization_id", orgId);
        if (error) throw error;
        toast.success("Plod type updated");
      } else {
        const { error } = await supabase.from("plod_types").insert(payload);
        if (error) throw error;
        toast.success("Plod type created");
      }

      closeModal();
      await load();
    } catch (e) {
      console.error("save plod type", e);
      toast.error(e?.message || "Failed to save plod type");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    if (!orgId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("plod_types")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("organization_id", orgId);

      if (error) throw error;
      await load();
    } catch (e) {
      console.error("toggle plod type", e);
      toast.error(e?.message || "Failed to update plod type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">
          {loading ? "Loading…" : `${plodTypes.length} item${plodTypes.length === 1 ? "" : "s"}`}
        </div>

        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!orgId}>
          Add Plod Type
        </button>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full text-xs md:text-sm min-w-[720px]">
            <thead>
              <tr className="text-left bg-slate-900/40 text-slate-200 border-b border-white/10">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Description</th>
                <th className="p-2 font-medium">Sort</th>
                <th className="p-2 font-medium">Active</th>
                <th className="p-2 font-medium w-[1%]"></th>
              </tr>
            </thead>

            <tbody>
              {plodTypes.map((t) => (
                <tr key={t.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                  <td className="p-2 font-medium">{t.name}</td>
                  <td className="p-2">{t.description || "—"}</td>
                  <td className="p-2">{t.sort_order ?? 0}</td>
                  <td className="p-2">{t.is_active ? "Yes" : "No"}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5 mr-2"
                      onClick={() => openEdit(t)}
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                      onClick={() => toggleActive(t)}
                      disabled={saving}
                    >
                      {t.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && plodTypes.length === 0 && (
                <tr>
                  <td className="p-2 text-slate-300/70" colSpan={5}>
                    No plod types yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PlodTypeModal
        open={showModal}
        onClose={closeModal}
        onSave={save}
        saving={saving}
        form={form}
        setForm={setForm}
        isEditing={!!editingId}
      />
    </div>
  );
}