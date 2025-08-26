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
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, [supabase]);

  const loadMemberships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: ms, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations(name)')
        .eq('user_id', user.id);
      if (error) throw error;
      setMemberships(ms || []);
      if ((ms || []).length > 0 && !ms.find(m => m.organization_id === orgId)) {
        setOrgId(ms[0].organization_id);
      }
    } catch (e) {
      toast.error('Could not load organizations');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, orgId]);

  useEffect(() => { loadMemberships(); }, [loadMemberships]);

  const value = { orgId, setOrgId, memberships, loading, refreshMemberships: loadMemberships };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}
