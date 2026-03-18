"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { EditIconButton } from "@/app/components/ActionIconButton";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { normalizeHoleDescriptorKey } from "@/lib/holeDescriptors";

function DrillingTypeModal({ open, onClose, onSave, saving, form, setForm, isEditing }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{isEditing ? "Edit Drilling Type" : "New Drilling Type"}</h2>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            Name
            <input
              className="input w-full"
              value={form.name}
              onChange={(event) =>
                setForm((current) => {
                  const nextName = event.target.value;
                  return {
                    ...current,
                    name: nextName,
                    key: current.keyTouched ? current.key : normalizeHoleDescriptorKey(nextName),
                  };
                })
              }
              placeholder="e.g. Diamond"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            Key
            <input
              className="input w-full font-mono"
              value={form.key}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  key: normalizeHoleDescriptorKey(event.target.value),
                  keyTouched: true,
                }))
              }
              placeholder="e.g. diamond"
              required
            />
            <span className="text-xs text-slate-400">Used in imports and internal matching. Lowercase letters, numbers, and underscores only.</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            Category (optional)
            <input
              className="input w-full"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="e.g. method or purpose"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            Active
            <select
              className="input w-full"
              value={form.is_active ? "yes" : "no"}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === "yes" }))}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim() || !form.key.trim()}>
              {saving ? "Saving..." : isEditing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DrillingTypesAdminPanel({ orgId }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descriptors, setDescriptors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    key: "",
    keyTouched: false,
    category: "",
    is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!orgId) {
      setDescriptors([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("hole_descriptors")
      .select("id,name,key,category,sort_order,is_active,created_at")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("load hole_descriptors", error);
      toast.error(error.message || "Failed to load drilling types");
      setDescriptors([]);
    } else {
      setDescriptors(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (descriptor) => {
    setEditingId(descriptor.id);
    setForm({
      name: descriptor.name || "",
      key: descriptor.key || "",
      keyTouched: true,
      category: descriptor.category || "",
      is_active: !!descriptor.is_active,
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

    const name = form.name.trim();
    const key = normalizeHoleDescriptorKey(form.key);
    if (!name) return;
    if (!key) return toast.error("Key is required");

    setSaving(true);
    try {
      const nextSortOrder = descriptors.reduce((maxValue, descriptor) => Math.max(maxValue, Number(descriptor.sort_order) || 0), 0) + 1;
      const payload = {
        organization_id: orgId,
        name,
        key,
        category: form.category.trim() || null,
        is_active: !!form.is_active,
      };

      if (editingId) {
        const { error } = await supabase
          .from("hole_descriptors")
          .update(payload)
          .eq("id", editingId)
          .eq("organization_id", orgId);
        if (error) throw error;
        toast.success("Drilling type updated");
      } else {
        const { error } = await supabase.from("hole_descriptors").insert({
          ...payload,
          sort_order: nextSortOrder,
        });
        if (error) throw error;
        toast.success("Drilling type created");
      }

      closeModal();
      await load();
    } catch (error) {
      console.error("save hole descriptor", error);
      toast.error(error?.message || "Failed to save drilling type");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (descriptor) => {
    if (!orgId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("hole_descriptors")
        .update({ is_active: !descriptor.is_active })
        .eq("id", descriptor.id)
        .eq("organization_id", orgId);

      if (error) throw error;
      await load();
    } catch (error) {
      console.error("toggle hole descriptor", error);
      toast.error(error?.message || "Failed to update drilling type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300/70">
          {loading ? "Loading..." : `${descriptors.length} item${descriptors.length === 1 ? "" : "s"}`}
        </div>

        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!orgId}>
          Add Drilling Type
        </button>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto -mx-2 md:mx-0">
          <table className="w-full min-w-[760px] text-xs md:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/40 text-left text-slate-200">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Key</th>
                <th className="p-2 font-medium">Category</th>
                <th className="p-2 font-medium">Active</th>
                <th className="p-2 font-medium w-[1%]"></th>
              </tr>
            </thead>

            <tbody>
              {descriptors.map((descriptor) => (
                <tr key={descriptor.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5">
                  <td className="p-2 font-medium">{descriptor.name}</td>
                  <td className="p-2 font-mono text-slate-300/80">{descriptor.key}</td>
                  <td className="p-2">{descriptor.category || "-"}</td>
                  <td className="p-2">{descriptor.is_active ? "Yes" : "No"}</td>
                  <td className="whitespace-nowrap p-2 text-right">
                    <span className="mr-2 inline-flex align-middle">
                      <EditIconButton onClick={() => openEdit(descriptor)} disabled={saving} />
                    </span>
                    <button
                      type="button"
                      className="rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                      onClick={() => void toggleActive(descriptor)}
                      disabled={saving}
                    >
                      {descriptor.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && descriptors.length === 0 ? (
                <tr>
                  <td className="p-2 text-slate-300/70" colSpan={5}>
                    No drilling types yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <DrillingTypeModal
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