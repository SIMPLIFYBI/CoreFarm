"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setEmail(data?.session?.user?.email ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setEmail(s?.user?.email ?? "");
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase]);

  const setNewPassword = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Enter a short name");
    if (trimmed.length > 10) return toast.error("Name must be 10 characters or less");
    if (!password || password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setSaving(true);
    // If user has no name in metadata, set it now along with password
    const currentName = session?.user?.user_metadata?.name || session?.user?.raw_user_meta_data?.name;
    const { error } = await supabase.auth.updateUser({ password, data: currentName ? {} : { name: trimmed } });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You're all set.");
    router.replace("/");
  };

  if (!session?.user) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Finish registration</h1>
        <p className="text-sm text-gray-600">Open the invitation link from your email to get started, or sign in on the home page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Finish setting up your account</h1>
      <p className="text-sm text-gray-600 mb-4">Signed in as {email}</p>
      <form onSubmit={setNewPassword} className="space-y-3">
        <input
          type="text"
          className="input"
          placeholder="Your display name (≤ 10 chars)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={10}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={6}
          required
        />
        <button disabled={saving} className="w-full btn btn-primary">
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
