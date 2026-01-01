"use client";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

const OrgContext = createContext({
  orgId: "",
  setOrgId: () => {},
  memberships: [],
  loading: true,
  refreshMemberships: () => {},
});

function isDemoOrgName(name) {
  const n = (name || "").toLowerCase().trim();
  return n === "demo organisation" || n === "shared demo" || n.includes("demo");
}

export function OrgProvider({ children }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // <-- ADD
  const [memberships, setMemberships] = useState([]);

  // Initialize from localStorage immediately (prevents "newest membership wins" overwriting it on refresh)
  const [orgId, _setOrgId] = useState(() => {
    try {
      return typeof window !== "undefined" ? window.localStorage.getItem("cf_org_id") || "" : "";
    } catch (_) {
      return "";
    }
  });

  const [loading, setLoading] = useState(true);

  // Load user (initial) and listen for auth state changes
  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data?.user || null);
      setAuthReady(true); // <-- ADD (auth check completed)
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user || null);
      setAuthReady(true); // <-- ADD (auth event received)
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const loadMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: ms, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, created_at, organizations(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = ms || [];
      setMemberships(list);

      // If current orgId is valid, keep it (this is the "remember last org" behavior)
      if (orgId && list.find((m) => m.organization_id === orgId)) {
        return;
      }

      // Otherwise, try the stored org (in case state was empty but storage has it)
      let stored = "";
      try {
        stored = typeof window !== "undefined" ? window.localStorage.getItem("cf_org_id") || "" : "";
      } catch (_) {}

      if (stored && list.find((m) => m.organization_id === stored)) {
        _setOrgId(stored);
        return;
      }

      // Fallback: pick a non-demo org if possible, else the newest membership
      const nonDemo = list.find((m) => !isDemoOrgName(m.organizations?.name));
      const fallback = nonDemo?.organization_id || list[0]?.organization_id || "";

      if (fallback) {
        _setOrgId(fallback);
        try {
          window.localStorage.setItem("cf_org_id", fallback);
        } catch (_) {}
      }
    } catch (e) {
      toast.error("Could not load organizations");
    } finally {
      setLoading(false);
    }
  }, [user, supabase, orgId]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  // When user logs out, clear org selection
  useEffect(() => {
    // IMPORTANT: don't clear on first render when user is still loading
    if (!authReady) return;

    if (!user) {
      _setOrgId("");
      try {
        window.localStorage.removeItem("cf_org_id");
      } catch (_) {}
    }
  }, [user, authReady]); // <-- UPDATE deps

  // Wrapped setter persists to localStorage
  const setOrgId = (val) => {
    _setOrgId(val);
    try {
      if (val) window.localStorage.setItem("cf_org_id", val);
    } catch (_) {}
  };

  const value = { orgId, setOrgId, memberships, loading, refreshMemberships: loadMemberships };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}
