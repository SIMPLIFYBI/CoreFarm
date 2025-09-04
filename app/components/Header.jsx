"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { IconCore, IconAdmin, IconTeam, IconUser, IconLogin, IconReport, IconClipboard, IconCoreTasks, AssetIcon } from "../components/icons";

export default function Header() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [userId, setUserId] = useState(null);
  const { orgId, memberships } = useOrg();

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

  // Derive current org name from context
  const currentOrgName = (() => {
    if (!orgId) return null;
    const m = memberships.find(m => m.organization_id === orgId);
    return m?.organizations?.name || null;
  })();

  // Sign out now handled at bottom of Team page

  const navTabs = [
  { href: "/user", label: "Dashboard", icon: IconReport },
  { href: "/coretasks", label: "Core Tasks", icon: IconCoreTasks },
  { href: "/consumables", label: "Consumables", icon: IconCore },
  { href: "/projects", label: "Projects", icon: IconClipboard },
  { href: "/assets", label: "Assets", icon: AssetIcon },
  { href: "/team", label: "Team", icon: IconTeam },
  ];
  return (
    <header className="border-b bg-gradient-to-r from-indigo-50 via-indigo-100 to-purple-50 md:sticky md:top-0 md:z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto max-w-6xl flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link href="/preview" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-white/0">
              <Image src="/demo/SimplifyBI.png" alt="SimplifyBI" width={32} height={32} className="object-contain" />
            </span>
            <span className="hidden sm:block">SimplifyBI</span>
          </Link>
          <nav className="hidden md:flex gap-2 text-sm">
            {navTabs.map((t) => {
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
          {currentOrgName && (
            <button
              type="button"
              onClick={() => router.push("/team")}
              className="inline-flex flex-col justify-center h-8 px-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm border border-white/20 max-w-[160px] overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-400"
              title={`${currentOrgName}${email ? ' — ' + email : ''}`}
            >
              <span className="text-[10px] leading-tight font-medium truncate">
                {currentOrgName}
              </span>
              {email && (
                <span className="text-[9px] leading-tight opacity-90 truncate -mt-0.5">
                  {email}
                </span>
              )}
            </button>
          )}
          {!email && (
            <Link href="/" className="btn">
              <IconLogin /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
