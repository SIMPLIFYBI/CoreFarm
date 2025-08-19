"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { IconCore, IconAdmin, IconTeam, IconUser, IconLogout, IconLogin } from "../components/icons";

export default function Header() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [userId, setUserId] = useState(null);
  const [orgNames, setOrgNames] = useState([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data?.user;
      setEmail(u?.email ?? null);
      setDisplayName(u?.user_metadata?.name || u?.raw_user_meta_data?.name || null);
      setUserId(u?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setDisplayName(session?.user?.user_metadata?.name || session?.user?.raw_user_meta_data?.name || null);
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

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
      const names = (data || [])
        .map((m) => m.organizations?.name)
        .filter(Boolean);
      setOrgNames(names);
    }
    loadOrgs();
    return () => {
      aborted = true;
    };
  }, [supabase, userId]);

  const onSignOut = async () => {
    await supabase.auth.signOut();
  router.push("/");
  };

  return (
    <header className="border-b bg-gradient-to-r from-indigo-50 via-indigo-100 to-purple-50">
      <div className="mx-auto max-w-6xl flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link href="/core" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm">CF</span>
            <span className="hidden sm:block">CoreFarm</span>
          </Link>
          <nav className="hidden md:flex gap-2 text-sm">
            {[
              { href: "/core", label: "Logging", icon: IconAdmin },
              { href: "/user", label: "My Dashboard", icon: IconUser },
              { href: "/admin", label: "Add Core", icon: IconCore },
              { href: "/team", label: "Team", icon: IconTeam },
              { href: "/consumables", label: "Consumables", icon: IconCore },
            ].map((t) => {
              const active = pathname?.startsWith(t.href);
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={
                    "flex items-center gap-2 px-2 py-1 rounded-full transition-base " +
                    (active ? "text-indigo-600 bg-white/70" : "text-gray-700 hover:opacity-80")
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                    <Icon />
                  </span>
                  <span className="text-center">{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="text-sm flex items-center gap-3">
          {orgNames.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-white shadow-sm">
              Org: {orgNames.length === 1 ? orgNames[0] : `${orgNames[0]} +${orgNames.length - 1}`}
            </span>
          )}
          {email ? (
            <button onClick={onSignOut} className="btn">
              <IconLogout /> <span className="hidden sm:block">Sign out</span> <span className="sm:hidden">Out</span>
            </button>
          ) : (
            <Link href="/" className="btn">
              <IconLogin /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
