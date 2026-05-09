"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { redirectTo } from "@/lib/siteUrl";
import toast from "react-hot-toast";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6">Loading…</div>}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const requestedFlow = searchParams.get("flow") === "setup" ? "setup" : null;
  const [mode, setMode] = useState(requestedMode); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [invites, setInvites] = useState([]); // pending invites for the signed-in email
  const [checkingInvites, setCheckingInvites] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  useEffect(() => {
    setMode((current) => (current === requestedMode ? current : requestedMode));
  }, [requestedMode]);

  useEffect(() => {
    const errorDescription = searchParams.get("error_description");
    const code = searchParams.get("code");
    if (errorDescription) {
      toast.error(errorDescription);
    }
    if (!code) {
      return;
    }

    let active = true;

    const finalizeAuthCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (!active) {
        return;
      }
      if (error) {
        toast.error(error.message);
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());
      [
        "code",
        "error",
        "error_description",
        "type",
        "token_hash",
        "access_token",
        "refresh_token",
        "expires_at",
        "expires_in",
      ].forEach((key) => nextParams.delete(key));
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `/?${nextQuery}` : "/");
    };

    finalizeAuthCallback();

    return () => {
      active = false;
    };
  }, [router, searchParams, supabase]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase]);

  useEffect(() => {
    // If signed in, check for pending invites; if none, redirect to app
    (async () => {
      if (!session?.user) return;
      if (recoveryMode || requestedFlow === "setup") return;
      setCheckingInvites(true);
      const email = (session.user.email || "").toLowerCase();
      const { data: invs, error } = await supabase
        .from("organization_invites")
        .select("id, organization_id, role, email, status, invited_by, organizations(name), inviter:invited_by(email)")
        .eq("email", email)
        .eq("status", "pending");
      if (error) {
        setCheckingInvites(false);
  return router.replace("/map");
      }
      if ((invs || []).length === 0) {
        setCheckingInvites(false);
  return router.replace("/map");
      }
      setInvites(invs || []);
      setCheckingInvites(false);
    })();
  }, [recoveryMode, requestedFlow, session, router, supabase]);

  const signIn = async (e) => {
    e.preventDefault();
    setLoading(true);
  const normalized = (email || "").trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
  // Do not redirect immediately; the invites checker will route if none are pending
  };

  const signUp = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Enter a short name");
    if (trimmed.length > 10) return toast.error("Name must be 10 characters or less");
    setLoading(true);
    const normalized = (email || "").trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        data: { name: trimmed },
        emailRedirectTo: redirectTo("/"),
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account");
  };

  const goTeam = () => router.push("/team");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    router.replace(nextMode === "signup" ? "/?mode=signup" : "/?mode=signin");
  };

  const acceptInvite = async (inv) => {
    if (!session?.user) return;
    const userId = session.user.id;
    // Insert membership as self; RLS allows via self-join policy
    const { error: mErr } = await supabase
      .from("organization_members")
      .insert({ organization_id: inv.organization_id, user_id: userId, role: inv.role });
    if (mErr) {
      // If membership already exists, treat as success
      const { data: existing } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", inv.organization_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        toast.error("Could not join organization");
        return;
      }
      await supabase.from("organization_invites").update({ status: "accepted" }).eq("id", inv.id);
      toast.success("You’re already a member. Invite accepted");
  router.replace("/map");
      return;
    }
    await supabase.from("organization_invites").update({ status: "accepted" }).eq("id", inv.id);
    toast.success("Joined organization");
  router.replace("/map");
  };

  const sendReset = async () => {
    if (!email) {
      return toast.error("Enter your email above first");
    }
    setLoading(true);
    const normalized = (email || "").trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: redirectTo("/"),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("If an account exists, a reset link was sent");
  };

  const finishAccountSetup = async (e) => {
    e.preventDefault();
    const existingName = session?.user?.user_metadata?.name || session?.user?.raw_user_meta_data?.name || "";
    const trimmedName = name.trim();

    if (!existingName && !trimmedName) return toast.error("Enter a short name");
    if (trimmedName && trimmedName.length > 10) return toast.error("Name must be 10 characters or less");
    if (!setupPassword || setupPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (setupPassword !== setupConfirm) return toast.error("Passwords do not match");

    setSavingSetup(true);
    const { error } = await supabase.auth.updateUser({
      password: setupPassword,
      data: existingName ? {} : { name: trimmedName },
    });
    setSavingSetup(false);

    if (error) return toast.error(error.message);

    toast.success("Account created. You're all set.");
    setSetupPassword("");
    setSetupConfirm("");
    router.replace("/");
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setRecoveryMode(false);
    setNewPassword("");
  router.replace("/dashboard");
  };

  const existingName = session?.user?.user_metadata?.name || session?.user?.raw_user_meta_data?.name || "";
  const showSetupForm = requestedFlow === "setup" && !!session?.user && !recoveryMode;
  const inputClassName =
    "w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 focus:bg-slate-950/80";
  const secondaryButtonClassName =
    "rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.09] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClassName =
    "w-full rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(14,116,144,0.92))] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_20px_50px_rgba(34,211,238,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-2 md:px-6 md:pb-8 md:pt-3">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_420px] lg:items-start">
        <section className="space-y-5">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,47,73,0.82)_48%,rgba(6,78,59,0.74))] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.38)] md:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
                Mining operations workspace
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-5xl">WorkMine</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
                The operating system for modern mining teams.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                Map drillholes, run drilling workflows, and keep field operations connected in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))] p-5 shadow-[0_30px_120px_rgba(2,6,23,0.34)] md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Account access</div>
              <div className="mt-1 text-xl font-semibold text-white">
                {showSetupForm ? "Finish setup" : recoveryMode ? "Reset password" : mode === "signin" ? "Sign in" : "Create account"}
              </div>
            </div>
            {!showSetupForm && !recoveryMode ? (
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                <button
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    mode === "signin" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-white",
                  ].join(" ")}
                  onClick={() => switchMode("signin")}
                  disabled={showSetupForm}
                >
                  Sign in
                </button>
                <button
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    mode === "signup" ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-white",
                  ].join(" ")}
                  onClick={() => switchMode("signup")}
                  disabled={showSetupForm}
                >
                  Create account
                </button>
              </div>
            ) : null}
          </div>

        {recoveryMode && (
          <div className="mb-5 rounded-[24px] border border-cyan-300/16 bg-cyan-400/[0.06] p-4 text-sm text-slate-200">
            <div className="mb-2 font-medium text-white">Set a new password</div>
            <form onSubmit={updatePassword} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="password"
                className={`${inputClassName} flex-1`}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <button className={primaryButtonClassName} disabled={updatingPassword}>
                {updatingPassword ? "Updating…" : "Update"}
              </button>
            </form>
          </div>
        )}
        {showSetupForm && (
          <div className="mb-5 rounded-[24px] border border-emerald-300/16 bg-emerald-400/[0.06] p-4 text-sm">
            <div className="mb-2 font-medium text-white">Finish setting up your account</div>
            <p className="mb-4 text-slate-300">
              Signed in as {session.user.email}
            </p>
            <form onSubmit={finishAccountSetup} className="space-y-3">
              {!existingName && (
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="Your display name (≤ 10 chars)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={10}
                  required
                />
              )}
              <input
                type="password"
                className={inputClassName}
                placeholder="Choose a password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                minLength={6}
                required
              />
              <input
                type="password"
                className={inputClassName}
                placeholder="Confirm password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                minLength={6}
                required
              />
              <button disabled={savingSetup} className={primaryButtonClassName}>
                {savingSetup ? "Saving…" : "Save and continue"}
              </button>
            </form>
          </div>
        )}
        {session?.user && invites.length > 0 && (
          <div className="mb-5 rounded-[24px] border border-indigo-300/18 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(15,23,42,0.2),rgba(168,85,247,0.12))] p-4 text-sm shadow-[0_18px_50px_rgba(2,6,23,0.16)]">
            <div className="mb-3 flex items-center gap-2 font-medium text-white">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(99,102,241,0.95),rgba(168,85,247,0.95))] text-[10px] font-semibold text-white">INV</span>
              <span>You have pending invites</span>
            </div>
            <ul className="space-y-2">
              {invites.map((inv) => {
                const inviterEmail = inv.inviter?.email || inv.invited_by || '';
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3">
                    <div className="flex flex-col truncate">
                      <span className="truncate font-medium text-white">{inv.organizations?.name || inv.organization_id}</span>
                      <span className="truncate text-[11px] text-slate-400">Role: {inv.role}{inviterEmail && ` • Invited by ${inviterEmail}`}</span>
                    </div>
                    <button className="rounded-xl bg-[linear-gradient(135deg,rgba(99,102,241,0.94),rgba(168,85,247,0.94))] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110" onClick={() => acceptInvite(inv)}>
                      Accept
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex gap-2">
              <button className={secondaryButtonClassName} onClick={goTeam}>Manage in Team</button>
              <button className={secondaryButtonClassName} onClick={() => router.replace('/map')}>Skip for now</button>
            </div>
          </div>
        )}
        {session?.user && checkingInvites && invites.length === 0 && (
          <div className="mb-4 text-xs text-slate-500">Checking for team invites…</div>
        )}

        {!showSetupForm && (
          <form onSubmit={mode === "signin" ? signIn : signUp} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              className={inputClassName}
              placeholder="Your display name (≤ 10 chars)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
            />
          )}
          <input
            type="email"
            className={inputClassName}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={inputClassName}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="text-right">
            <button type="button" className="text-xs font-medium text-cyan-300 transition hover:text-cyan-200" onClick={sendReset}>
              Forgot password?
            </button>
          </div>
          <button disabled={loading} className={primaryButtonClassName}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          </form>
        )}

        {!session?.user && !showSetupForm && !recoveryMode && (
          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Prefer to look around first?</div>
            <div className="mt-1 text-base font-semibold text-white">Continue as a guest</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Guest access opens the public demo immediately. Use it if you want to explore the product before signing in or creating an account.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-cyan-300/18 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/16"
              onClick={() => router.push("/map")}
            >
              Continue as guest
            </button>
          </div>
        )}

        <div className="mt-5 space-y-2 text-sm text-slate-400">
          <p className="leading-6">
            After creating an account and verifying your email, you’ll be able to join your existing company or start a new one.
          </p>
          {/* Removed legacy quick navigation buttons (Go to Team / Use magic link) to streamline onboarding */}
        </div>
        </section>
      </div>
    </div>
  );
}
 
