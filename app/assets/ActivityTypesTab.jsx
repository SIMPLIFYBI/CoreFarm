import React, { useEffect, useState } from 'react';

export default function ActivityTypesTab({ supabase, organizationId }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ key: '', label: '', group: '', description: '' });

  useEffect(() => {
    if (!organizationId || !supabase) return;
    let mounted = true;
    setLoading(true);
    supabase
      .from('plod_activity_types')
      .select('*')
      .eq('organization_id', organizationId)
      .order('label', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setError(error.message);
        else setTypes(data || []);
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [organizationId, supabase]);

  async function createType(e) {
    e.preventDefault();
    setError(null);
    if (!form.key || !form.label) {
      setError('Key and label are required.');
      return;
    }
    setLoading(true);
    const payload = {
      organization_id: organizationId,
      key: form.key.trim(),
      label: form.label.trim(),
      group: form.group?.trim() || null,
      description: form.description?.trim() || null
    };
    const { data, error } = await supabase.from('plod_activity_types').insert([payload]);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ key: '', label: '', group: '', description: '' });
    // Refresh list
    setTypes(prev => [...(data || []), ...prev]);
  }

  return (
    <div>
      <h3>Activity types</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div style={{ marginBottom: 12 }}>
        <form onSubmit={createType}>
          <div>
            <input
              placeholder="key (unique)"
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
              required
            />
            <input
              placeholder="label"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              required
            />
          </div>
          <div>
            <input
              placeholder="group (optional)"
              value={form.group}
              onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
            />
            <input
              placeholder="description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading || !organizationId}>
            {loading ? 'Saving...' : 'Create activity type'}
          </button>
        </form>
      </div>

      <div>
        <h4>Existing types</h4>
        {loading && types.length === 0 ? (
          <div>Loading…</div>
        ) : (
          <ul>
            {types.map(t => (
              <li key={t.id}>
                <strong>{t.label}</strong> <small>({t.key})</small>
                {t.group ? <em> — {t.group}</em> : null}
                {t.description ? <div>{t.description}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}