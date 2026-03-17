"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { EditIconButton, DeleteIconButton } from "@/app/components/ActionIconButton";

export default function LocationsTable({ TABLE_HEAD_ROW, TABLE_ROW }) {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    if (!orgId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("asset_locations")
      .select("id, name, description")
      .eq("organization_id", orgId)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setLocations(data || []);
        setLoading(false);
      });
  }, [orgId, showModal, supabase]);

  const openModal = (loc = null) => {
    setEditLoc(loc);
    setForm(loc ? { name: loc.name, description: loc.description } : { name: "", description: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!orgId) {
      alert("Select an organization before saving a location.");
      return;
    }

    const payload = {
      name: form.name,
      description: form.description || null,
      organization_id: orgId,
    };

    if (editLoc) {
      const res = await supabase
        .from("asset_locations")
        .update({ name: payload.name, description: payload.description })
        .eq("id", editLoc.id)
        .eq("organization_id", orgId)
        .select()
        .single();
      if (res.error) {
        console.error("Failed to update location", res.error);
        alert("Error updating location: " + res.error.message);
        return;
      }
      setLocations((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
      setShowModal(false);
    } else {
      const res = await supabase.from("asset_locations").insert([payload]).select().single();
      if (res.error) {
        console.error("Failed to insert location", res.error);
        alert("Error creating location: " + res.error.message);
        return;
      }
      setLocations((prev) => [res.data, ...prev]);
      setShowModal(false);
    }
  };

  const handleDelete = async (id) => {
    if (!orgId) return;
    const res = await supabase.from("asset_locations").delete().eq("id", id).eq("organization_id", orgId).select();
    if (res.error) {
      console.error("Failed to delete location", res.error);
      alert("Error deleting location: " + res.error.message);
      return;
    }
    setLocations((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Locations</h2>
        <button className="btn btn-primary" onClick={() => openModal()} type="button">
          Add Location
        </button>
      </div>

      {!orgId ? (
        <div className="mb-4 rounded-xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
          Choose an organization before managing locations.
        </div>
      ) : null}

      <div className="overflow-x-auto -mx-2 md:mx-0">
        <table className="w-full text-xs md:text-sm min-w-[640px]">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className="p-2 font-medium">Name</th>
              <th className="p-2 font-medium">Description</th>
              <th className="p-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-slate-300/70">
                  Loading...
                </td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-slate-300/70">
                  No locations found.
                </td>
              </tr>
            ) : (
              locations.map((loc) => (
                <tr key={loc.id} className={TABLE_ROW}>
                  <td className="p-2 font-medium">{loc.name}</td>
                  <td className="p-2">{loc.description}</td>
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <EditIconButton onClick={() => openModal(loc)} />
                      <DeleteIconButton onClick={() => handleDelete(loc.id)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-slate-100">
              {editLoc ? "Edit Location" : "Add Location"}
            </h3>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <input
                className="input w-full"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                className="input w-full"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!orgId}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}