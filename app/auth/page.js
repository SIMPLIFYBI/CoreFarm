"use client";
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

// This page depends on URL search params and client auth; opt out of static prerendering
export const dynamic = 'force-dynamic';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-12">Loading…</div>}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const supabase = supabaseBrowser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [userId, setUserId] = useState(null);
  const [orgNames, setOrgNames] = useState([]);

  useEffect(() => {
    let mounted = true;
    // Handle magic link callback
    const code = searchParams.get('code');
    const errorDescription = searchParams.get('error_description');
    if (errorDescription) {
      toast.error(errorDescription);
    }
    if (code) {
      supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Signed in');
          // Clean query params
          router.replace('/auth');
        }
      });
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data?.user;
      setSessionEmail(u?.email ?? null);
      setDisplayName(u?.user_metadata?.name || u?.raw_user_meta_data?.name || null);
      setUserId(u?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
      setDisplayName(session?.user?.user_metadata?.name || session?.user?.raw_user_meta_data?.name || null);
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase, searchParams, router]);

  useEffect(() => {
    let aborted = false;
    async function loadOrgs() {
      if (!userId) {
        setOrgNames([]);
        return;
      }
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(name)')
        .eq('user_id', userId);
      if (aborted) return;
      if (error) {
        setOrgNames([]);
        return;
      }
      const names = (data || []).map((m) => m.organizations?.name).filter(Boolean);
      setOrgNames(names);
    }
    loadOrgs();
    return () => {
      aborted = true;
    };
  }, [supabase, userId]);

  const signIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Check your email for a magic link');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast.success('Signed out');
  router.push('/');
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <h1 className="text-2xl font-semibold">Auth</h1>
      {sessionEmail ? (
        <div className="space-y-3">
          <p className="text-sm flex items-center gap-2">
            <span>Signed in as {displayName || sessionEmail}</span>
            {orgNames.length > 0 && (
              <span className="text-xs px-2 py-0.5 border rounded bg-gray-50">
                Org: {orgNames.length === 1 ? orgNames[0] : `${orgNames[0]} +${orgNames.length - 1}`}
              </span>
            )}
          </p>
          <button onClick={signOut} className="btn btn-primary">Sign out</button>
        </div>
      ) : (
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button disabled={loading} className="btn btn-primary">
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  );
}
