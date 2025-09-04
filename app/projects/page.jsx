"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";

export default function ProjectsPage() {
  const supabase = supabaseBrowser();
  const { orgId } = useOrg();
  const [projects, setProjects] = useState([]);
  const [tenements, setTenements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTenements, setLoadingTenements] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = { name: "", start_date: "", finish_date: "", cost_code: "", wbs_code: "" };
  const [form, setForm] = useState(emptyForm);
  // Tenements state
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'tenements'
  const [showTenementModal, setShowTenementModal] = useState(false);
  const [savingTenement, setSavingTenement] = useState(false);
  const [editingTenementId, setEditingTenementId] = useState(null);
  const emptyTenement = {
    tenement_number: '',
    tenement_type: '',
    application_number: '',
    status: '',
    date_applied: '',
    date_granted: '',
    renewal_date: '',
    expenditure_commitment: '',
    heritage_agreements: ''
  };
  const [tenementForm, setTenementForm] = useState(emptyTenement);

  // Load projects
  useEffect(() => {
    if (!orgId) { setProjects([]); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id,name,start_date,finish_date,cost_code,wbs_code,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (!error) setProjects(data || []); else setProjects([]);
      setLoading(false);
    })();
  }, [orgId, supabase]);

  // Load tenements when org changes or when active tab switches
  useEffect(() => {
    if (activeTab !== 'tenements') return;
    if (!orgId) { setTenements([]); return; }
    (async () => {
      setLoadingTenements(true);
      const { data, error } = await supabase
        .from('tenements')
        .select('id,tenement_number,tenement_type,application_number,status,date_applied,date_granted,renewal_date,expenditure_commitment,heritage_agreements,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (!error) setTenements(data || []); else setTenements([]);
      setLoadingTenements(false);
    })();
  }, [activeTab, orgId, supabase]);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({
    name: p.name || "",
    start_date: p.start_date || "",
    finish_date: p.finish_date || "",
    cost_code: p.cost_code || "",
    wbs_code: p.wbs_code || "",
  }); setShowModal(true); };

  const saveProject = async () => {
    if (!orgId) return;
    if (!form.name.trim()) return; // minimal validation
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
        const { organization_id, ...updateFields } = payload; // don't move org
        res = await supabase.from('projects').update(updateFields).eq('id', editingId).select().single();
      } else {
        res = await supabase.from('projects').insert(payload).select().single();
      }
      if (res.error) throw res.error;
      // refresh list
      const { data } = await supabase
        .from('projects')
        .select('id,name,start_date,finish_date,cost_code,wbs_code,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      setProjects(data || []);
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (p) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    await supabase.from('projects').delete().eq('id', p.id);
    setProjects(prev => prev.filter(x => x.id !== p.id));
  };

  // Tenement CRUD
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
        expenditure_commitment: tenementForm.expenditure_commitment ? Number(tenementForm.expenditure_commitment) : null,
        heritage_agreements: tenementForm.heritage_agreements || null,
        organization_id: orgId,
      };
      let res;
      if (editingTenementId) {
        const { organization_id, ...updateFields } = payload;
        res = await supabase.from('tenements').update(updateFields).eq('id', editingTenementId).select().single();
      } else {
        res = await supabase.from('tenements').insert(payload).select().single();
      }
      if (res.error) throw res.error;
      // refresh list
      const { data } = await supabase
        .from('tenements')
        .select('id,tenement_number,tenement_type,application_number,status,date_applied,date_granted,renewal_date,expenditure_commitment,heritage_agreements,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      setTenements(data || []);
      setShowTenementModal(false);
      setEditingTenementId(null);
      setTenementForm(emptyTenement);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTenement(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Projects</h1>

      <div className="mb-6 flex gap-2 border-b">
        <button
          className={"px-4 py-2 -mb-px border-b-2 font-medium text-sm " + (activeTab === 'projects' ? 'border-indigo-500 text-indigo-700' : 'text-gray-600')}
          onClick={() => setActiveTab('projects')}
        >Projects</button>
        <button
          className={"px-4 py-2 -mb-px border-b-2 font-medium text-sm " + (activeTab === 'tenements' ? 'border-indigo-500 text-indigo-700' : 'text-gray-600')}
          onClick={() => setActiveTab('tenements')}
        >Tenements</button>
      </div>

      {activeTab === 'projects' ? (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="text-sm text-gray-600">{projects.length} project{projects.length===1?'':'s'}</div>
            <button onClick={openNew} className="btn btn-primary">New Project</button>
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium mb-3">Project List</div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-gray-500">No projects yet. Create your first one.</div>
            ) : (
              <div className="overflow-x-auto -mx-2 md:mx-0">
                <table className="w-full text-xs md:text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="p-2">Name</th>
                      <th className="p-2">Start</th>
                      <th className="p-2">Finish</th>
                      <th className="p-2 hidden md:table-cell">Cost Code</th>
                      <th className="p-2 hidden md:table-cell">WBS</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.id} className="border-b last:border-b-0 hover:bg-indigo-50/40">
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2 whitespace-nowrap">{p.start_date || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{p.finish_date || '—'}</td>
                        <td className="p-2 hidden md:table-cell">{p.cost_code || '—'}</td>
                        <td className="p-2 hidden md:table-cell">{p.wbs_code || '—'}</td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="btn btn-xs" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn btn-xs btn-danger" onClick={() => deleteProject(p)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        // Tenements tab
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="text-sm text-gray-600">{tenements.length} tenement{tenements.length===1?'':'s'}</div>
            <button onClick={() => { setEditingTenementId(null); setTenementForm(emptyTenement); setShowTenementModal(true); }} className="btn btn-primary">New Tenement</button>
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium mb-3">Tenement List</div>
            {loadingTenements ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : tenements.length === 0 ? (
              <div className="text-sm text-gray-500">No tenements yet. Create your first one.</div>
            ) : (
              <div className="overflow-x-auto -mx-2 md:mx-0">
                <table className="w-full text-xs md:text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="p-2">Tenement Number</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Applied</th>
                      <th className="p-2">Granted</th>
                      <th className="p-2">Renewal</th>
                      <th className="p-2 hidden md:table-cell">Expenditure</th>
                      <th className="p-2 hidden lg:table-cell">Heritage Agreements</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenements.map(t => (
                      <tr key={t.id} className="border-b last:border-b-0 hover:bg-indigo-50/40">
                        <td className="p-2 font-medium">{t.tenement_number}</td>
                        <td className="p-2">{t.tenement_type || '—'}</td>
                        <td className="p-2">{t.status || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{t.date_applied || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{t.date_granted || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{t.renewal_date || '—'}</td>
                        <td className="p-2 hidden md:table-cell">{t.expenditure_commitment ?? '—'}</td>
                        <td className="p-2 hidden lg:table-cell truncate max-w-[220px]">{t.heritage_agreements || '—'}</td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="btn btn-xs" onClick={() => { setEditingTenementId(t.id); setTenementForm({
                              tenement_number: t.tenement_number || '',
                              tenement_type: t.tenement_type || '',
                              application_number: t.application_number || '',
                              status: t.status || '',
                              date_applied: t.date_applied || '',
                              date_granted: t.date_granted || '',
                              renewal_date: t.renewal_date || '',
                              expenditure_commitment: t.expenditure_commitment ?? '',
                              heritage_agreements: t.heritage_agreements || ''
                            }); setShowTenementModal(true); }}>Edit</button>
                            <button className="btn btn-xs btn-danger" onClick={async () => {
                              if (!confirm(`Delete tenement "${t.tenement_number}"?`)) return;
                              const { error } = await supabase.from('tenements').delete().eq('id', t.id);
                              if (!error) setTenements(prev => prev.filter(x => x.id !== t.id));
                            }}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Project' : 'New Project'}</h2>
              <button className="btn" onClick={() => { setShowModal(false); setEditingId(null); }}>Close</button>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <label className="block text-sm">Name
                <input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="input" placeholder="Project Name" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">Start
                  <input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} className="input" />
                </label>
                <label className="block text-sm">Finish
                  <input type="date" value={form.finish_date} onChange={e=>setForm(f=>({...f,finish_date:e.target.value}))} className="input" />
                </label>
              </div>
              <label className="block text-sm">Cost Code
                <input type="text" value={form.cost_code} onChange={e=>setForm(f=>({...f,cost_code:e.target.value}))} className="input" />
              </label>
              <label className="block text-sm">WBS Code
                <input type="text" value={form.wbs_code} onChange={e=>setForm(f=>({...f,wbs_code:e.target.value}))} className="input" />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveProject} disabled={saving || !form.name.trim()} className="btn btn-primary flex-1">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Project'}
              </button>
              {editingId && (
                <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>New</button>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">Only members of this organization can see these projects.</div>
          </div>
        </div>
      )}
      {showTenementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingTenementId ? 'Edit Tenement' : 'New Tenement'}</h2>
              <button className="btn" onClick={() => { setShowTenementModal(false); setEditingTenementId(null); }}>Close</button>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <label className="block text-sm">Tenement Number
                <input type="text" value={tenementForm.tenement_number} onChange={e=>setTenementForm(f=>({...f,tenement_number:e.target.value}))} className="input" placeholder="Tenement Number" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">Type
                  <input type="text" value={tenementForm.tenement_type} onChange={e=>setTenementForm(f=>({...f,tenement_type:e.target.value}))} className="input" />
                </label>
                <label className="block text-sm">Application Number
                  <input type="text" value={tenementForm.application_number} onChange={e=>setTenementForm(f=>({...f,application_number:e.target.value}))} className="input" />
                </label>
              </div>
              <label className="block text-sm">Status
                <input type="text" value={tenementForm.status} onChange={e=>setTenementForm(f=>({...f,status:e.target.value}))} className="input" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm">Date Applied
                  <input type="date" value={tenementForm.date_applied} onChange={e=>setTenementForm(f=>({...f,date_applied:e.target.value}))} className="input" />
                </label>
                <label className="block text-sm">Date Granted
                  <input type="date" value={tenementForm.date_granted} onChange={e=>setTenementForm(f=>({...f,date_granted:e.target.value}))} className="input" />
                </label>
                <label className="block text-sm">Renewal Date
                  <input type="date" value={tenementForm.renewal_date} onChange={e=>setTenementForm(f=>({...f,renewal_date:e.target.value}))} className="input" />
                </label>
              </div>
              <label className="block text-sm">Expenditure Commitment
                <input type="number" value={tenementForm.expenditure_commitment} onChange={e=>setTenementForm(f=>({...f,expenditure_commitment:e.target.value}))} className="input" />
              </label>
              <label className="block text-sm">Heritage Agreements
                <textarea value={tenementForm.heritage_agreements} onChange={e=>setTenementForm(f=>({...f,heritage_agreements:e.target.value}))} className="input" rows={3} />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveTenement} disabled={savingTenement || !tenementForm.tenement_number.trim()} className="btn btn-primary flex-1">
                {savingTenement ? 'Saving…' : editingTenementId ? 'Save Changes' : 'Create Tenement'}
              </button>
              {editingTenementId && (
                <button type="button" className="btn" onClick={() => { setEditingTenementId(null); setTenementForm(emptyTenement); }}>New</button>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">Tenements are visible only to members of this organization.</div>
          </div>
        </div>
      )}
    </div>
  );
}
