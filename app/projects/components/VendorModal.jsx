"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function VendorModal({ orgId, onClose, onCreated }) {
  const supabase = supabaseBrowser();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const createVendor = async () => {
    if (!orgId) return toast.error("Organisation not ready");
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      // Adjust column names here if your vendors table uses different fields.
      const payload = {
        organization_id: orgId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      };

      const { data, error } = await supabase.from("vendors").insert(payload).select("*").single();
      if (error) throw error;

      toast.success("Vendor added");
      onCreated?.(data);
    } catch (e) {
      console.error("create vendor error", e);
      toast.error(e?.message || "Could not add vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">New Vendor</h2>
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            createVendor();
          }}
        >
          <label className="block text-sm">
            Vendor name
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>

          <label className="block text-sm">
            Email (optional)
            <input
              className="input w-full"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>

          <label className="block text-sm">
            Phone (optional)
            <input
              className="input w-full"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}