"use client";
import { useEffect, useMemo, useState, Fragment } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import toast from "react-hot-toast";
import { parseTable } from "@/lib/parseTable";

export default function AdminPage() {

const TASK_TYPES = [
  "orientation",
  "magnetic_susceptibility",
  "whole_core_sampling",
  "cutting",
  "rqd",
  "specific_gravity",
];

  const supabase = supabaseBrowser();
  const { orgId } = useOrg();
  const [holes, setHoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [user, setUser] = useState(null);
  const [savingHole, setSavingHole] = useState(false);
  const [single, setSingle] = useState({
    hole_id: "",
    depth: "",
    drilling_diameter: "",
  project_id: "",
  tenement_id: "",
    drilling_contractor: "",
  });
  const [showHoleModal, setShowHoleModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // hole id being edited (null = new)
  // Bulk upload modal state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [importing, setImporting] = useState(false);
  const [intervals, setIntervals] = useState({});
  const emptyIntervals = useMemo(() => TASK_TYPES.reduce((acc, t) => ({ ...acc, [t]: [] }), []), []);

  const selectHole = (h) => {
    setSelectedId(h.id);
    setSingle({
      hole_id: h.hole_id || "",
      depth: h.depth ?? "",
      drilling_diameter: h.drilling_diameter || "",
  project_id: h.project_id || "",
  tenement_id: h.tenement_id || null,
      drilling_contractor: h.drilling_contractor || "",
    });
    setIntervals(emptyIntervals);
  };

  const toggleExpandHole = (h) => {
    if (selectedId === h.id) {
      // collapse
      setSelectedId(null);
      setIntervals(emptyIntervals);
      return;
    }
    selectHole(h);
  };

  // Load user
  useEffect(() => {
    let sub;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user || null);
      const { data: s } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
      sub = s?.subscription;
      setLoading(false); // initial UI ready; holes load on org change
    })();
    return () => {
      sub?.unsubscribe?.();
    };
  }, [supabase]);

  // Load holes for current org from context
  useEffect(() => {
    if (!orgId) {
      setHoles([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_id, depth, drilling_diameter, project_id, tenement_id, drilling_contractor, created_at, organization_id, projects(name), tenements(tenement_number)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setHoles([]);
      } else {
        setHoles(data || []);
      }
      setLoading(false);
    })();
  }, [orgId, supabase]);

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
        project_id: single.project_id || null,
        tenement_id: single.tenement_id || null,
        drilling_contractor: single.drilling_contractor || null,
        organization_id: orgId || null,
      };
      setSavingHole(true);
      let res;
      if (editingId) {
        // Do not change organization_id on update to avoid cross-org moves
        const { organization_id, ...updateFields } = payload;
        res = await supabase.from("holes").update(updateFields).eq("id", editingId).select().single();
      } else {
        res = await supabase.from("holes").insert(payload).select().single();
      }
      if (res.error) throw res.error;
      toast.success(editingId ? "Hole updated" : "Hole created");
      // Select the created/updated hole for intervals
      setSelectedId(res.data.id);
      setIntervals(emptyIntervals);
      // refresh list
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_id, depth, drilling_diameter, project_id, tenement_id, drilling_contractor, created_at, organization_id, projects(name), tenements(tenement_number)")
        .eq("organization_id", orgId)
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
      // Close modal
      setShowHoleModal(false);
      setEditingId(null);
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
    const allowed = ["hole_id", "depth", "drilling_diameter"]; // simplified: no project_id or contractor via bulk upload
    const invalid = Object.keys(rows[0]).filter((k) => !allowed.includes(k));
    if (invalid.length) return toast.error(`Unexpected headers: ${invalid.join(", ")}`);
    const payloads = rows.map((r) => ({
      hole_id: String(r.hole_id || "").trim(),
      depth: (() => { const n = Number(r.depth); return r.depth === "" || r.depth == null || !Number.isFinite(n) ? null : n; })(),
      drilling_diameter: r.drilling_diameter || null,
      project_id: null,
      drilling_contractor: null,
      organization_id: orgId || null,
    })).filter((p) => p.hole_id);
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
      .select("id, hole_id, depth, drilling_diameter, project_id, drilling_contractor, created_at, organization_id, projects(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setHoles(data || []);
  };

  // Interval helpers
  const addInterval = (taskType) => {
    setIntervals((prev) => ({
      ...prev,
      [taskType]: [...(prev[taskType] || []), { from_m: "", to_m: "" }],
    }));
  };
  const changeInterval = (taskType, idx, field, value) => {
    setIntervals((prev) => {
      const arr = [...(prev[taskType] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [taskType]: arr };
    });
  };
  const removeInterval = (taskType, idx) => {
    setIntervals((prev) => {
      const arr = [...(prev[taskType] || [])];
      arr.splice(idx, 1);
      return { ...prev, [taskType]: arr };
    });
  };
  const saveIntervals = async () => {
    if (!selectedId) return toast.error("Select a hole first");
    // Build rows
    const rows = TASK_TYPES.flatMap((t) =>
      (intervals[t] || []).map((r) => ({
        hole_id: selectedId,
        task_type: t,
        from_m: parseFloat(r.from_m),
        to_m: parseFloat(r.to_m),
      }))
    ).filter((r) => Number.isFinite(r.from_m) && Number.isFinite(r.to_m));
    // Replace existing intervals for simplicity
    const { error: delErr } = await supabase.from("hole_task_intervals").delete().eq("hole_id", selectedId);
    if (delErr) return toast.error(delErr.message);
    if (rows.length) {
      const { error: insErr } = await supabase.from("hole_task_intervals").insert(rows);
      if (insErr) return toast.error(insErr.message);
    }
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
      setSingle({ hole_id: "", depth: "", drilling_diameter: "", project_id: "", drilling_contractor: "" });
      setIntervals({});
    }
  };

  const sampleHeaders = useMemo(() => (
    "hole_id,depth,drilling_diameter\n" +
    "HOLE-001,150,NQ\n" +
    "HOLE-002,220,HQ\n"
  ), []);

  // ...existing code...
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
  <h1 className="text-2xl font-semibold">Add Holes / Tasks</h1>
  {/* Organization pill removed (header now shows active organization) */}
      {!user && (
        <div className="p-3 border rounded bg-yellow-50 text-sm">
          You’re not signed in. Sign in on the Auth page to create or edit holes (RLS requires authentication).
        </div>
      )}

  {/* Add / Edit Hole now handled via modal; trigger button below */}

      {/* Bulk upload: hidden on mobile, available on desktop */}
      <section className="space-y-3 hidden md:block">
        <h2 className="text-xl font-medium">Bulk upload</h2>
        <p className="text-sm text-gray-600">Paste CSV/TSV from Excel with headers: hole_id, depth, drilling_diameter</p>
        <div>
          <button type="button" onClick={() => { setShowBulk(true); setParsed([]); }} className="btn btn-primary">Open bulk uploader</button>
        </div>
      </section>
      <section className="md:hidden space-y-2">
        <h2 className="text-xl font-medium">Bulk upload</h2>
        <p className="text-sm text-gray-600 italic">Bulk upload available on desktop</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-medium">Holes & Tasks</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setSingle({ hole_id: "", depth: "", drilling_diameter: "", project_id: "", drilling_contractor: "" });
              setShowHoleModal(true);
            }}
          >Add New Core</button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{width:40}}></th>
                  <th>Hole ID</th>
                  <th>Depth</th>
                  <th className="hidden md:table-cell">Diameter</th>
                  <th className="hidden md:table-cell">Project</th>
                  <th className="hidden md:table-cell">Contractor</th>
                  <th className="hidden md:table-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <Fragment key={h.id}>
                    <tr
                      className={`${selectedId === h.id ? 'row-selected' : ''}`}
                    >
                      <td>
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => toggleExpandHole(h)}
                          title={selectedId === h.id ? 'Collapse' : 'Expand'}
                        >{selectedId === h.id ? '−' : '+'}</button>
                      </td>
                      <td className="font-medium">{h.hole_id}</td>
                      <td>{h.depth}</td>
                      <td className="hidden md:table-cell">{h.drilling_diameter}</td>
                      <td className="hidden md:table-cell">{h.projects?.name || ''}</td>
                      <td className="hidden md:table-cell">{h.drilling_contractor}</td>
                      <td className="hidden md:table-cell">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-xs"
                            onClick={() => {
                              setEditingId(h.id);
                              setSingle({
                                hole_id: h.hole_id || "",
                                depth: h.depth ?? "",
                                drilling_diameter: h.drilling_diameter || "",
                                project_id: h.project_id || "",
                                drilling_contractor: h.drilling_contractor || "",
                              });
                              setShowHoleModal(true);
                            }}
                          >Edit</button>
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            onClick={() => deleteHole(h.id)}
                          >Del</button>
                        </div>
                      </td>
                    </tr>
                    {selectedId === h.id && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={7} className="p-0">
                          <div className="p-4 space-y-4 border-t">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-sm">Task intervals</h3>
                              <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => saveIntervals()}
                                disabled={!selectedId}
                              >Save Tasks</button>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              {TASK_TYPES.map((t) => (
                                <div key={t} className="card p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs uppercase tracking-wide">{t.replace(/_/g,' ')}</span>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-primary shrink-0 w-20 text-[10px] justify-center"
                                      onClick={() => addInterval(t)}
                                      style={{letterSpacing:"0.5px"}}
                                    >+ Interval</button>
                                  </div>
                                  <div className="space-y-2">
                                    {(intervals[t] || []).map((row, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <input
                                          className="input input-xs w-8 md:w-20"
                                          placeholder="From"
                                          value={row.from_m}
                                          onChange={(e) => changeInterval(t, idx, 'from_m', e.target.value)}
                                        />
                                        <span className="text-xs">→</span>
                                        <input
                                          className="input input-xs w-8 md:w-20"
                                          placeholder="To"
                                          value={row.to_m}
                                          onChange={(e) => changeInterval(t, idx, 'to_m', e.target.value)}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-xs"
                                          onClick={() => removeInterval(t, idx)}
                                        >×</button>
                                      </div>
                                    ))}
                                    {!intervals[t]?.length && (
                                      <div className="text-xs text-gray-500 italic">None</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

  {/* Tasks editor now embedded inline per hole row above */}

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
                      </tr>
                    </thead>
                    <tbody>
                      {(parsed || []).slice(0, 200).map((r, i) => (
                        <tr key={i}>
                          <td>{r.hole_id}</td>
                          <td>{r.depth}</td>
                          <td>{r.drilling_diameter}</td>
                        </tr>
                      ))}
                      {parsed.length === 0 && (
                        <tr><td colSpan={3} className="text-center text-sm text-gray-500">Paste data to preview</td></tr>
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
              <div className="text-xs text-gray-600 ml-auto">Required column: hole_id. Optional: depth, drilling_diameter.</div>
            </div>
          </div>
        </div>
      )}

      {showHoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Core' : 'Add New Core'}</h2>
              <button
                className="btn"
                onClick={() => { setShowHoleModal(false); setEditingId(null); }}
              >Close</button>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <label className="block text-sm">Hole ID
                <input type="text" name="hole_id" value={single.hole_id} onChange={onChangeSingle} className="input" placeholder="HOLE-001" />
              </label>
              <label className="block text-sm">Depth (m)
                <input type="number" step="any" name="depth" value={single.depth} onChange={onChangeSingle} className="input" placeholder="e.g. 220" />
              </label>
              <label className="block text-sm">Drilling Diameter
                <select name="drilling_diameter" value={single.drilling_diameter} onChange={onChangeSingle} className="select-gradient-sm">
                  <option value="">Select…</option>
                  <option value="NQ">NQ</option>
                  <option value="HQ">HQ</option>
                  <option value="PQ">PQ</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="block text-sm">Project
                <ProjectSelect supabase={supabase} organizationId={orgId} value={single.project_id} onChange={(v) => setSingle(s => ({...s, project_id: v}))} />
              </label>
              <label className="block text-sm">Tenement
                <TenementSelect supabase={supabase} organizationId={orgId} value={single.tenement_id} onChange={(v) => setSingle(s => ({...s, tenement_id: v}))} />
              </label>
              <label className="block text-sm">Drilling Contractor
                <input type="text" name="drilling_contractor" value={single.drilling_contractor} onChange={onChangeSingle} className="input" />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveSingle}
                disabled={savingHole || !single.hole_id || !user}
                className="btn btn-primary flex-1"
              >
                {savingHole ? 'Saving…' : editingId ? 'Save Changes' : 'Add Hole'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingId(null);
                    setSingle({ hole_id: '', depth: '', drilling_diameter: '', project_id: '', drilling_contractor: '' });
                  }}
                >New</button>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">After saving you can manage task intervals below the table.</div>
          </div>
        </div>
      )}
    </div>
  );
}


// Helper component for selecting project
function ProjectSelect({ supabase, organizationId, value, onChange }) {
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    if (!organizationId) { setProjects([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name')
        .eq('organization_id', organizationId)
        .order('name');
      if (!error) setProjects(data || []);
    })();
  }, [organizationId, supabase]);
  return (
    <select className="select-gradient-sm" value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Select…</option>
      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

// Helper component for selecting tenement
function TenementSelect({ supabase, organizationId, value, onChange }) {
  const [tenements, setTenements] = useState([]);
  useEffect(() => {
    if (!organizationId) { setTenements([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from('tenements')
        .select('id,tenement_number')
        .eq('organization_id', organizationId)
        .order('tenement_number');
      if (!error) setTenements(data || []);
    })();
  }, [organizationId, supabase]);
  return (
    <select className="select-gradient-sm" value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Select…</option>
      {tenements.map(t => <option key={t.id} value={t.id}>{t.tenement_number}</option>)}
    </select>
  );
}
