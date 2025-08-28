"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { redirectTo } from "@/lib/siteUrl";
import toast from "react-hot-toast";

export default function HomePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup
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
      setCheckingInvites(true);
      const email = (session.user.email || "").toLowerCase();
      const { data: invs, error } = await supabase
        .from("organization_invites")
        .select("id, organization_id, role, email, status, organizations(name)")
        .eq("email", email)
        .eq("status", "pending");
      if (error) {
        setCheckingInvites(false);
  return router.replace("/user");
      }
      if ((invs || []).length === 0) {
        setCheckingInvites(false);
  return router.replace("/user");
      }
      setInvites(invs || []);
      setCheckingInvites(false);
    })();
  }, [session, router, supabase]);

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
  router.replace("/user");
      return;
    }
    await supabase.from("organization_invites").update({ status: "accepted" }).eq("id", inv.id);
    toast.success("Joined organization");
  router.replace("/user");
  };

  const sendReset = async () => {
  if (!email) {
      return toast.error("Enter your email above first");
    }
    setLoading(true);
  const normalized = (email || "").trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: redirectTo("/register"),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("If an account exists, a reset link was sent");
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
  router.replace("/user");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid md:grid-cols-2 gap-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">CoreFarm Core Logging</h1>
        <p className="text-gray-600">
          Plan intervals, capture actuals, and see progress across your drilling program. Secure, multi-tenant access for your team.
        </p>
        <ul className="list-disc ml-5 text-gray-700 text-sm space-y-1">
          <li>Task-based intervals and non-overlapping progress</li>
          <li>Invite teammates and manage roles</li>
          <li>Fast data entry UI designed for the core yard</li>
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
        {session?.user && invites.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <div className="font-medium mb-2">You have pending invites</div>
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between">
                  <span>
                    {inv.organizations?.name || inv.organization_id} — role: {inv.role}
                  </span>
                  <button className="btn text-xs" onClick={() => acceptInvite(inv)}>
                    Accept
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button className="btn text-xs" onClick={goTeam}>Manage in Team</button>
              <button className="btn text-xs" onClick={() => router.replace("/user")}>Skip for now</button>
            </div>
          </div>
        )}
        {session?.user && checkingInvites && invites.length === 0 && (
          <div className="mb-4 text-xs text-gray-500">Checking for team invites…</div>
        )}
        <div className="flex gap-4 mb-4">
          <button
            className={`btn text-sm ${mode === "signin" ? "bg-gray-100" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            className={`btn text-sm ${mode === "signup" ? "bg-gray-100" : ""}`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

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
 
