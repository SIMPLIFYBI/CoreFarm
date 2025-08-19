"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { parseTable } from "@/lib/parseTable";

const TASK_TYPES = [
  "orientation",
  "magnetic_susceptibility",
  "whole_core_sampling",
  "cutting",
  "rqd",
  "specific_gravity",
];

export default function AdminPage() {
  const supabase = supabaseBrowser();
  const [holes, setHoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]); // {organization_id, organizations: {name}, role}
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [savingHole, setSavingHole] = useState(false);
  const [single, setSingle] = useState({
    hole_id: "",
    depth: "",
    drilling_diameter: "",
    project_name: "",
    drilling_contractor: "",
  });
  // Bulk upload modal state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [importing, setImporting] = useState(false);
  const [intervals, setIntervals] = useState({});
  const emptyIntervals = useMemo(() => TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), {}), []);

  const selectHole = (h) => {
    setSelectedId(h.id);
    setSingle({
      hole_id: h.hole_id || "",
      depth: h.depth ?? "",
      drilling_diameter: h.drilling_diameter || "",
      project_name: h.project_name || "",
      drilling_contractor: h.drilling_contractor || "",
    });
    // Clear intervals immediately so UI reflects the new selection
    setIntervals(emptyIntervals);
  };

  // Load user and memberships; holes are loaded when org is selected
  useEffect(() => {
    let sub;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);
      const { data: s } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
      sub = s?.subscription;
      // Load memberships to pick an org context
      const { data: ms, error: mErr } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(name)")
        .eq("user_id", userData?.user?.id);
      if (mErr) {
        toast.error("Could not load organizations");
      }
      setMemberships(ms || []);
      if ((ms || []).length > 0) setSelectedOrgId(ms[0].organization_id);
      setLoading(false); // initial UI ready; holes load on org change
    })();
    return () => {
      sub?.unsubscribe?.();
    };
  }, [supabase]);

  // Load holes for selected org
  useEffect(() => {
    if (!selectedOrgId) {
      setHoles([]);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_id, depth, drilling_diameter, project_name, drilling_contractor, created_at, organization_id")
        .eq("organization_id", selectedOrgId)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setHoles([]);
      } else {
        setHoles(data || []);
      }
      setLoading(false);
    })();
  }, [selectedOrgId, supabase]);

  // When selecting a hole, load its intervals only (don't override form while editing)
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const { data, error } = await supabase
        .from("hole_task_intervals")
        .select("id, task_type, from_m, to_m")
        .eq("hole_id", selectedId)
        .order("from_m", { ascending: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      const grouped = TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), {});
      for (const row of data || []) {
        if (!grouped[row.task_type]) grouped[row.task_type] = [];
        grouped[row.task_type].push({ id: row.id, from_m: row.from_m, to_m: row.to_m });
      }
      setIntervals(grouped);
    })();
  }, [selectedId, supabase]);

  const onChangeSingle = (e) => {
    const { name, value } = e.target;
    setSingle((s) => ({ ...s, [name]: value }));
  };

  const saveSingle = async () => {
    try {
      // Auth guard (RLS requires a user)
      if (!user) {
        toast.error("Sign in required to save");
        return;
      }
      // Validation
      const idTrim = String(single.hole_id || "").trim();
      if (!idTrim) {
        toast.error("Hole ID is required");
        return;
      }
      const depthNum = single.depth === "" || single.depth == null ? null : parseFloat(String(single.depth));
      const payload = {
        hole_id: idTrim,
        depth: Number.isFinite(depthNum) ? depthNum : null,
        drilling_diameter: single.drilling_diameter || null,
        project_name: single.project_name || null,
        drilling_contractor: single.drilling_contractor || null,
  organization_id: selectedOrgId || null,
      };
      setSavingHole(true);
      let res;
      if (selectedId) {
  // Do not change organization_id on update to avoid cross-org moves
  const { organization_id, ...updateFields } = payload;
  res = await supabase.from("holes").update(updateFields).eq("id", selectedId).select().single();
      } else {
        res = await supabase.from("holes").insert(payload).select().single();
      }
      if (res.error) throw res.error;
      toast.success(selectedId ? "Hole updated" : "Hole created");
      // Select the created/updated hole and reveal intervals
      setSelectedId(res.data.id);
      setIntervals(emptyIntervals);
      // refresh list
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_id, depth, drilling_diameter, project_name, drilling_contractor, created_at, organization_id")
        .eq("organization_id", selectedOrgId)
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback optimistic update
        setHoles((prev) => {
          const others = prev.filter((h) => h.id !== res.data.id);
          return [res.data, ...others];
        });
      } else if (data) {
        setHoles(data);
      }
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSavingHole(false);
    }
  };

  const onBulkUpload = async () => {
  const rows = parsed.length ? parsed : parseTable(bulkText);
    if (!rows.length) return toast.error("No rows found");
    // Expect headers matching keys
    const allowed = ["hole_id", "depth", "drilling_diameter", "project_name", "drilling_contractor"];
    const invalid = Object.keys(rows[0]).filter((k) => !allowed.includes(k));
    if (invalid.length) {
      return toast.error(`Unexpected headers: ${invalid.join(", ")}`);
    }
    const payloads = rows.map((r) => ({
      hole_id: String(r.hole_id || "").trim(),
      depth: (() => { const n = Number(r.depth); return r.depth === "" || r.depth == null || !Number.isFinite(n) ? null : n; })(),
      drilling_diameter: r.drilling_diameter || null,
      project_name: r.project_name || null,
      drilling_contractor: r.drilling_contractor || null,
      organization_id: selectedOrgId || null,
    })).filter(p => p.hole_id);
    if (!payloads.length) return toast.error("No valid rows (missing hole_id)");
  setImporting(true);
  const { error } = await supabase.from("holes").insert(payloads);
  setImporting(false);
    if (error) return toast.error(error.message);
  toast.success(`Inserted ${payloads.length} holes`);
  setBulkText("");
  setParsed([]);
  setShowBulk(false);
    const { data } = await supabase
      .from("holes")
      .select("id, hole_id, depth, drilling_diameter, project_name, drilling_contractor, created_at, organization_id")
      .eq("organization_id", selectedOrgId)
      .order("created_at", { ascending: false });
    setHoles(data || []);
  };

  const addInterval = (type) => {
    setIntervals((m) => {
      const base = TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: m?.[t] || [] }), {});
      base[type] = [...base[type], { from_m: "", to_m: "" }];
      return base;
    });
  };

  const changeInterval = (type, idx, key, value) => {
    setIntervals((m) => {
      const base = TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: m?.[t] || [] }), {});
      const list = [...base[type]];
      list[idx] = { ...(list[idx] || { from_m: "", to_m: "" }), [key]: value };
      base[type] = list;
      return base;
    });
  };

  const removeInterval = (type, idx) => {
    setIntervals((m) => {
      const base = TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: m?.[t] || [] }), {});
      const list = [...base[type]];
      list.splice(idx, 1);
      base[type] = list;
      return base;
    });
  };

  const saveIntervals = async () => {
    if (!selectedId) return toast.error("Select a hole first");
    // For simplicity: delete existing intervals for selected hole, then insert current ones
    const { error: delErr } = await supabase.from("hole_task_intervals").delete().eq("hole_id", selectedId);
    if (delErr) return toast.error(delErr.message);
    const rows = [];
    for (const type of TASK_TYPES) {
      for (const row of intervals[type] || []) {
        const from_m = row.from_m === "" ? null : Number(row.from_m);
        const to_m = row.to_m === "" ? null : Number(row.to_m);
        if (Number.isFinite(from_m) && Number.isFinite(to_m)) {
          rows.push({ hole_id: selectedId, task_type: type, from_m, to_m });
        }
      }
    }
    if (rows.length === 0) {
      toast.success("Cleared intervals");
      return;
    }
    const { error } = await supabase.from("hole_task_intervals").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Intervals saved");
  };

  const deleteHole = async (id) => {
    if (!user) return toast.error("Sign in required");
    const hole = holes.find((h) => h.id === id);
    const label = hole?.hole_id ? `hole ${hole.hole_id}` : "this hole";
    if (!confirm(`Delete ${label}? This will also remove its planned tasks and actuals.`)) return;
    const { error } = await supabase.from("holes").delete().eq("id", id);
    if (error) return toast.error(error.message || "Failed to delete");
    toast.success("Hole deleted");
    setHoles((prev) => prev.filter((h) => h.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setSingle({ hole_id: "", depth: "", drilling_diameter: "", project_name: "", drilling_contractor: "" });
      setIntervals({});
    }
  };

  const sampleHeaders = useMemo(() => (
    "hole_id,depth,drilling_diameter,project_name,drilling_contractor\n" +
    "HOLE-001,150,NQ,Project A,Contractor X\n" +
    "HOLE-002,220,HQ,Project A,Contractor Y\n"
  ), []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Add Holes/Tasks</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Organization</span>
        {memberships && memberships.length > 0 ? (
          <span className="text-xs px-2 py-0.5 border rounded bg-gray-50">
            {memberships[0]?.organizations?.name || memberships[0]?.organization_id}
          </span>
        ) : (
          <span className="text-xs text-gray-600">Join or create an organization on the Team page to add holes.</span>
        )}
      </div>
      {!user && (
        <div className="p-3 border rounded bg-yellow-50 text-sm">
          You’re not signed in. Sign in on the Auth page to create or edit holes (RLS requires authentication).
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Add / Edit Hole</h2>
        <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">Hole ID
            <input type="text" name="hole_id" value={single.hole_id} onChange={onChangeSingle} className="input" placeholder="HOLE-001" />
          </label>
          <label className="block text-sm">Depth (m)
            <input type="number" step="any" name="depth" value={single.depth} onChange={onChangeSingle} className="input" placeholder="e.g. 220" />
          </label>
          <label className="block text-sm">Drilling Diameter
            <select name="drilling_diameter" value={single.drilling_diameter} onChange={onChangeSingle} className="select">
              <option value="">Select…</option>
              <option value="NQ">NQ</option>
              <option value="HQ">HQ</option>
              <option value="PQ">PQ</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block text-sm">Project Name
            <input type="text" name="project_name" value={single.project_name} onChange={onChangeSingle} className="input" />
          </label>
          <label className="block text-sm">Drilling Contractor
            <input type="text" name="drilling_contractor" value={single.drilling_contractor} onChange={onChangeSingle} className="input" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveSingle} disabled={savingHole || !single.hole_id || !user} className="btn btn-primary">
            {savingHole ? "Saving…" : "Save hole"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setSingle({
                hole_id: "",
                depth: "",
                drilling_diameter: "",
                project_name: "",
                drilling_contractor: "",
              });
              setIntervals({});
            }}
            className="btn"
          >
            New
          </button>
        </div>
      </section>

      {/* Bulk upload: hidden on mobile, available on desktop */}
      <section className="space-y-3 hidden md:block">
        <h2 className="text-xl font-medium">Bulk upload</h2>
        <p className="text-sm text-gray-600">Paste CSV/TSV from Excel with headers: hole_id, depth, drilling_diameter, project_name, drilling_contractor</p>
        <div>
          <button type="button" onClick={() => { setShowBulk(true); setParsed([]); }} className="btn btn-primary">Open bulk uploader</button>
        </div>
      </section>
      <section className="md:hidden space-y-2">
        <h2 className="text-xl font-medium">Bulk upload</h2>
        <p className="text-sm text-gray-600 italic">Bulk upload available on desktop</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Holes</h2>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Hole ID</th>
                  <th>Depth</th>
                  <th>Diameter</th>
                  <th>Project</th>
                  <th>Contractor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <tr
                    key={h.id}
                    className={`cursor-pointer ${selectedId === h.id ? 'row-selected' : ''}`}
                    onClick={() => selectHole(h)}
                  >
                    <td>{h.hole_id}</td>
                    <td>{h.depth}</td>
                    <td>{h.drilling_diameter}</td>
                    <td>{h.project_name}</td>
                    <td>{h.drilling_contractor}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={(e) => { e.stopPropagation(); deleteHole(h.id); }}
                          title="Delete this hole"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedId && (
        <section className="space-y-3">
          <h2 className="text-xl font-medium">Tasks for selected hole</h2>
          <p className="text-sm text-gray-600">Add intervals for each task type (meters)</p>
          <div className="space-y-6">
            {TASK_TYPES.map((t) => (
              <div key={t} className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{t.replace(/_/g, " ")}</h3>
                  <button type="button" onClick={() => addInterval(t)} className="btn btn-primary">Add interval</button>
                </div>
                <div className="space-y-2">
                  {(intervals[t] || []).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-8 gap-2 items-center">
                      <label className="col-span-3 text-sm">From (m)
                        <input value={row.from_m} onChange={(e) => changeInterval(t, idx, "from_m", e.target.value)} className="input input-sm" />
                      </label>
                      <label className="col-span-3 text-sm">To (m)
                        <input value={row.to_m} onChange={(e) => changeInterval(t, idx, "to_m", e.target.value)} className="input input-sm" />
                      </label>
                      <div className="col-span-2 flex justify-end">
                        <button type="button" onClick={() => removeInterval(t, idx)} className="btn">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" onClick={saveIntervals} className="btn btn-primary">Save tasks</button>
          </div>
        </section>
      )}

      {/* Bulk upload modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="card w-full max-w-5xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Bulk upload holes</h3>
              <button className="btn" onClick={() => setShowBulk(false)}>Close</button>
            </div>
            <div className="mb-3 text-sm font-bold text-red-700">
              Copy and paste must include the column header exactly the same as displayed below
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Paste CSV/TSV (first row headers)</label>
                <textarea
                  autoFocus
                  rows={10}
                  className="textarea font-mono"
                  placeholder={sampleHeaders}
                  value={bulkText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkText(v);
                    try {
                      const rows = parseTable(v);
                      setParsed(rows);
                    } catch (_e) {
                      setParsed([]);
                    }
                  }}
                />
                <div className="mt-2 text-xs text-gray-600">Tip: You can paste directly from Excel/Sheets; tabs are supported.</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-gray-700">Preview</div>
                  <div className="text-xs text-gray-600">
                    Rows: {parsed.length || 0}
                  </div>
                </div>
                <div className="table-container" style={{ maxHeight: 320 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>hole_id</th>
                        <th>depth</th>
                        <th>drilling_diameter</th>
                        <th>project_name</th>
                        <th>drilling_contractor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(parsed || []).slice(0, 200).map((r, i) => (
                        <tr key={i}>
                          <td>{r.hole_id}</td>
                          <td>{r.depth}</td>
                          <td>{r.drilling_diameter}</td>
                          <td>{r.project_name}</td>
                          <td>{r.drilling_contractor}</td>
                        </tr>
                      ))}
                      {parsed.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-sm text-gray-500">Paste data to preview</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onBulkUpload}
                className="btn btn-primary"
                disabled={importing || !parsed.length}
              >
                {importing ? "Importing…" : "Import"}
              </button>
              <button type="button" className="btn" onClick={() => { setBulkText(""); setParsed([]); }}>Clear</button>
              <div className="text-xs text-gray-600 ml-auto">Required column: hole_id. Optional: depth, drilling_diameter, project_name, drilling_contractor.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
