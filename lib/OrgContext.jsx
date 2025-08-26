"use client";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

const OrgContext = createContext({
  orgId: '',
  setOrgId: () => {},
  memberships: [],
  loading: true,
  refreshMemberships: () => {}
});

export function OrgProvider({ children }) {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  // orgId initialised from localStorage (persist last selection)
  const [orgId, _setOrgId] = useState('');
  const [loading, setLoading] = useState(true);

  // Load user and any persisted org selection
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      try {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('cf_org_id') : null;
        if (stored) _setOrgId(stored);
      } catch (_) { /* ignore storage errors */ }
    })();
  }, [supabase]);

  const loadMemberships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: ms, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, created_at, organizations(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); // newest membership first (recent invite just accepted)
      if (error) throw error;
      setMemberships(ms || []);
      // If current orgId not in refreshed memberships (first load or user just accepted new invite), pick newest membership
      if ((ms || []).length > 0 && !ms.find(m => m.organization_id === orgId)) {
        _setOrgId(ms[0].organization_id);
        try { if (ms[0].organization_id) window.localStorage.setItem('cf_org_id', ms[0].organization_id); } catch (_) {}
      }
    } catch (e) {
      toast.error('Could not load organizations');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, orgId]);

  useEffect(() => { loadMemberships(); }, [loadMemberships]);

  // Wrapped setter persists to localStorage
  const setOrgId = (val) => {
    _setOrgId(val);
    try { if (val) window.localStorage.setItem('cf_org_id', val); } catch (_) {}
  };

  const value = { orgId, setOrgId, memberships, loading, refreshMemberships: loadMemberships };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}
