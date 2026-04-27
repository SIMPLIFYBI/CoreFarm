"use client";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

const ORG_STORAGE_KEY = "cf_org_id";
const ORG_SELECTION_MODE_STORAGE_KEY = "cf_org_selection_mode";
const ORG_SELECTION_MODE_MANUAL = "manual";
const ORG_SELECTION_MODE_AUTO_DEMO = "auto-demo";

const OrgContext = createContext({
  orgId: "",
  setOrgId: () => {},
  memberships: [],
  currentOrgName: "",
  isDemoOrg: false,
  loading: true,
  refreshMemberships: () => {},
});

export function isDemoOrgName(name) {
  const n = (name || "").toLowerCase().trim();
  return n === "demo organisation" || n === "shared demo" || n.includes("demo");
}

function readStoredOrgId() {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(ORG_STORAGE_KEY) || "" : "";
  } catch (_) {
    return "";
  }
}

function readStoredOrgSelectionMode() {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(ORG_SELECTION_MODE_STORAGE_KEY) || "" : "";
  } catch (_) {
    return "";
  }
}

export function OrgProvider({ children }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false); // <-- ADD
  const [memberships, setMemberships] = useState([]);

  // Initialize from localStorage immediately (prevents "newest membership wins" overwriting it on refresh)
  const [orgId, _setOrgId] = useState(() => readStoredOrgId());
  const [orgSelectionMode, setOrgSelectionMode] = useState(() => readStoredOrgSelectionMode());

  const [loading, setLoading] = useState(true);

  const persistOrgSelection = useCallback((nextOrgId, nextMode = ORG_SELECTION_MODE_MANUAL) => {
    _setOrgId(nextOrgId || "");
    setOrgSelectionMode(nextMode || "");

    try {
      if (!nextOrgId) {
        window.localStorage.removeItem(ORG_STORAGE_KEY);
        window.localStorage.removeItem(ORG_SELECTION_MODE_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(ORG_STORAGE_KEY, nextOrgId);
      if (nextMode) {
        window.localStorage.setItem(ORG_SELECTION_MODE_STORAGE_KEY, nextMode);
      } else {
        window.localStorage.removeItem(ORG_SELECTION_MODE_STORAGE_KEY);
      }
    } catch (_) {}
  }, []);

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
      const demoMembership = list.find((membership) => isDemoOrgName(membership.organizations?.name));
      const nonDemoMembership = list.find((membership) => !isDemoOrgName(membership.organizations?.name));

      // If current orgId is valid, keep it (this is the "remember last org" behavior)
      if (orgId && list.find((m) => m.organization_id === orgId)) {
        const currentMembership = list.find((membership) => membership.organization_id === orgId);
        if (
          orgSelectionMode === ORG_SELECTION_MODE_AUTO_DEMO
          && currentMembership
          && isDemoOrgName(currentMembership.organizations?.name)
          && nonDemoMembership
          && nonDemoMembership.organization_id !== orgId
        ) {
          persistOrgSelection(nonDemoMembership.organization_id, ORG_SELECTION_MODE_MANUAL);
        }
        return;
      }

      // Otherwise, try the stored org (in case state was empty but storage has it)
      const stored = readStoredOrgId();
      const storedMode = readStoredOrgSelectionMode();

      if (stored && list.find((m) => m.organization_id === stored)) {
        const storedMembership = list.find((membership) => membership.organization_id === stored);
        if (
          storedMode === ORG_SELECTION_MODE_AUTO_DEMO
          && storedMembership
          && isDemoOrgName(storedMembership.organizations?.name)
          && nonDemoMembership
          && nonDemoMembership.organization_id !== stored
        ) {
          persistOrgSelection(nonDemoMembership.organization_id, ORG_SELECTION_MODE_MANUAL);
          return;
        }

        persistOrgSelection(stored, storedMode || ORG_SELECTION_MODE_MANUAL);
        return;
      }

      if (demoMembership) {
        persistOrgSelection(demoMembership.organization_id, ORG_SELECTION_MODE_AUTO_DEMO);
        return;
      }

      // Fallback when no demo membership exists.
      const fallback = nonDemoMembership?.organization_id || list[0]?.organization_id || "";

      if (fallback) {
        persistOrgSelection(fallback, ORG_SELECTION_MODE_MANUAL);
      }
    } catch (e) {
      toast.error("Could not load organizations");
    } finally {
      setLoading(false);
    }
  }, [user, supabase, orgId, orgSelectionMode, persistOrgSelection]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  // When user logs out, clear org selection
  useEffect(() => {
    // IMPORTANT: don't clear on first render when user is still loading
    if (!authReady) return;

    if (!user) {
      persistOrgSelection("", "");
    }
  }, [user, authReady, persistOrgSelection]); // <-- UPDATE deps

  // Wrapped setter persists to localStorage
  const setOrgId = (val, options = {}) => {
    persistOrgSelection(val, options.mode || ORG_SELECTION_MODE_MANUAL);
  };

  const currentOrg = useMemo(() => memberships.find((membership) => membership.organization_id === orgId) || null, [memberships, orgId]);
  const currentOrgName = currentOrg?.organizations?.name || "";
  const isDemoOrg = isDemoOrgName(currentOrgName);

  const value = { orgId, setOrgId, memberships, currentOrgName, isDemoOrg, loading, refreshMemberships: loadMemberships };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}
