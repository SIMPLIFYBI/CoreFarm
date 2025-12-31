"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function LocationsTable({ TABLE_HEAD_ROW, TABLE_ROW }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    const supabase = supabaseBrowser();
    setLoading(true);
    supabase
      .from("asset_locations")
      .select("id, name, description")
      .then(({ data }) => {
        setLocations(data || []);
        setLoading(false);
      });
  }, [showModal]);

  const openModal = (loc = null) => {
    setEditLoc(loc);
    setForm(loc ? { name: loc.name, description: loc.description } : { name: "", description: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    const supabase = supabaseBrowser();
    if (editLoc) {
      const res = await supabase.from("asset_locations").update(form).eq("id", editLoc.id).select().single();
      if (res.error) {
        console.error("Failed to update location", res.error);
        alert("Error updating location: " + res.error.message);
        return;
      }
      setLocations((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
      setShowModal(false);
    } else {
      const res = await supabase.from("asset_locations").insert([form]).select().single();
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
    const supabase = supabaseBrowser();
    const res = await supabase.from("asset_locations").delete().eq("id", id).select();
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
                    <button className="btn btn-xs" onClick={() => openModal(loc)} type="button">
                      Edit
                    </button>
                    <button className="btn btn-xs btn-danger ml-2" onClick={() => handleDelete(loc.id)} type="button">
                      Delete
                    </button>
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
                <button type="submit" className="btn btn-primary">
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