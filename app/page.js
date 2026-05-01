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

  return (
    <div className="max-w-6xl mx-auto p-6 grid md:grid-cols-2 gap-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">WorkMine</h1>
        <p className="text-gray-600">
          Plan, Manage and track your mining operations with ease. WorkMine is designed to help you stay organized, collaborate with your team, and keep your projects on track. With WorkMine, you can:
        </p>
        <ul className="list-disc ml-5 text-gray-700 text-sm space-y-1">
          <li>Record Plods for any mining activity</li>
          <li>Track progress and performance metrics</li>
          <li>Track consumables and resources</li>
          <li>Invite teammates and manage roles</li>
        </ul>
      </div>

      <div className="border rounded p-5">
        {recoveryMode && (
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <div className="font-medium mb-2">Set a new password</div>
            <form onSubmit={updatePassword} className="flex gap-2 items-center">
              <input
                type="password"
                className="flex-1 border rounded px-3 py-2"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
              <button className="btn btn-primary" disabled={updatingPassword}>
                {updatingPassword ? "Updating…" : "Update"}
              </button>
            </form>
          </div>
        )}
        {showSetupForm && (
          <div className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <div className="font-medium mb-2">Finish setting up your account</div>
            <p className="mb-4 text-gray-600">
              Signed in as {session.user.email}
            </p>
            <form onSubmit={finishAccountSetup} className="space-y-3">
              {!existingName && (
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Your display name (≤ 10 chars)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={10}
                  required
                />
              )}
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                placeholder="Choose a password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                minLength={6}
                required
              />
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                placeholder="Confirm password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                minLength={6}
                required
              />
              <button disabled={savingSetup} className="w-full btn btn-primary">
                {savingSetup ? "Saving…" : "Save and continue"}
              </button>
            </form>
          </div>
        )}
        {session?.user && invites.length > 0 && (
          <div className="mb-5 rounded p-4 text-sm bg-gradient-to-r from-indigo-50 via-white to-purple-50 border border-indigo-100 shadow-sm">
            <div className="font-medium mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[10px] font-semibold">INV</span>
              <span>You have pending invites</span>
            </div>
            <ul className="space-y-2">
              {invites.map((inv) => {
                const inviterEmail = inv.inviter?.email || inv.invited_by || '';
                return (
                  <li key={inv.id} className="flex items-center justify-between gap-3 bg-white/60 rounded px-3 py-2 border border-indigo-100">
                    <div className="flex flex-col truncate">
                      <span className="font-medium truncate">{inv.organizations?.name || inv.organization_id}</span>
                      <span className="text-[11px] text-gray-600 truncate">Role: {inv.role}{inviterEmail && ` • Invited by ${inviterEmail}`}</span>
                    </div>
                    <button className="btn btn-primary btn-gradient text-xs" onClick={() => acceptInvite(inv)}>
                      Accept
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex gap-2">
              <button className="btn text-xs" onClick={goTeam}>Manage in Team</button>
              <button className="btn text-xs" onClick={() => router.replace('/map')}>Skip for now</button>
            </div>
          </div>
        )}
        {session?.user && checkingInvites && invites.length === 0 && (
          <div className="mb-4 text-xs text-gray-500">Checking for team invites…</div>
        )}
        <div className="flex gap-4 mb-4">
          <button
            className={`btn text-sm ${mode === "signin" ? "bg-gray-100" : ""}`}
            onClick={() => switchMode("signin")}
            disabled={showSetupForm}
          >
            Sign in
          </button>
          <button
            className={`btn text-sm ${mode === "signup" ? "bg-gray-100" : ""}`}
            onClick={() => switchMode("signup")}
            disabled={showSetupForm}
          >
            Create account
          </button>
        </div>

        {!showSetupForm && (
          <form onSubmit={mode === "signin" ? signIn : signUp} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="Your display name (≤ 10 chars)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
            />
          )}
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="text-right">
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={sendReset}>
              Forgot password?
            </button>
          </div>
          <button disabled={loading} className="w-full btn btn-primary">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          </form>
        )}

        {!session?.user && !showSetupForm && !recoveryMode && (
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              className="w-full btn"
              onClick={() => router.push("/map")}
            >
              Continue as guest
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600 space-y-2">
          <p>
            After creating an account and verifying your email, you’ll be able to join your existing company or start a new one.
          </p>
          {/* Removed legacy quick navigation buttons (Go to Team / Use magic link) to streamline onboarding */}
        </div>
      </div>
    </div>
  );
}
 
