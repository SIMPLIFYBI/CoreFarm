"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import {
  IconCore,
  IconAdmin,
  IconTeam,
  IconUser,
  IconLogin,
  IconReport,
  IconClipboard,
  IconCoreTasks,
  AssetIcon,
  IconPlods,
} from "./icons";

export default function Header() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [userId, setUserId] = useState(null);
  const { orgId, memberships } = useOrg();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  // Close menu when navigating (including query string changes like /projects?tab=...)
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, searchParams]);

  // Projects accordion state (only expands when clicked)
  const [projectsExpanded, setProjectsExpanded] = useState(false);

  const projectsChildren = useMemo(
    () => [
      { label: "Projects", href: "/projects?tab=projects" },
      { label: "Tenements", href: "/projects?tab=tenements" },
      { label: "Locations", href: "/projects?tab=locations" },
      { label: "Resources", href: "/projects?tab=resources" },
      { label: "Vendors", href: "/projects?tab=vendors" },
      { label: "Contracts", href: "/projects?tab=contracts" },
      { label: "Activities", href: "/projects?tab=activities" },
      { label: "Plod Types", href: "/projects?tab=plodtypes" }, // <-- ADD
    ],
    []
  );

  useEffect(() => {
    // Close menu when navigating
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

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
    let alive = true;

    const run = async () => {
      try {
        // If RPC doesn't exist yet, we fail closed (hide link) without breaking UI.
        const { data, error } = await supabase.rpc("is_app_admin_rpc");
        if (!alive) return;
        if (error) {
          setIsAppAdmin(false);
          return;
        }
        setIsAppAdmin(Boolean(data));
      } catch {
        if (!alive) return;
        setIsAppAdmin(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const currentOrgName = useMemo(() => {
    if (!orgId) return null;
    const m = memberships.find((m) => m.organization_id === orgId);
    return m?.organizations?.name || null;
  }, [orgId, memberships]);

  const navTabs = [
    { href: "/dashboard", label: "Dashboard", icon: IconReport },
    { href: "/coretasks", label: "Core Tasks", icon: IconCoreTasks },
    { href: "/consumables", label: "Consumables", icon: IconCore },
    { href: "/projects", label: "Projects", icon: IconClipboard },
    { href: "/assets", label: "Assets", icon: AssetIcon },
    { href: "/plods", label: "Plods", icon: IconPlods },
    { href: "/team", label: "Team", icon: IconTeam },
    ...(isAppAdmin ? [{ href: "/admin/subscriptions", label: "Subscriptions", icon: IconAdmin }] : []),
  ];

  const activeProjectsChildHref = useMemo(() => {
    if (pathname !== "/projects") return null;
    const t = searchParams.get("tab") || "projects";
    return `/projects?tab=${t}`;
  }, [pathname, searchParams]);

  return (
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] border-b border-white/10 bg-slate-950/55 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/45">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Burger */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-base text-slate-100 focus-ring"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="app-nav-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            {/* hamburger icon (3 lines only) */}
            <span aria-hidden="true" className="flex flex-col justify-center gap-1.5">
              <span className="block h-[2px] w-5 rounded-full bg-current" />
              <span className="block h-[2px] w-5 rounded-full bg-current" />
              <span className="block h-[2px] w-5 rounded-full bg-current" />
            </span>
          </button>

          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link className="flex items-center" href="/home">
              <Image
                src="/demo/GeoFarm.png"
                alt="GeoFarm Logo"
                width={120}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Remove the horizontal nav */}
          {/* (intentionally not rendering nav across the top anymore) */}
        </div>

        <div className="text-sm flex items-center gap-3">
          {currentOrgName && (
            <button
              type="button"
              className="glass inline-flex flex-col justify-center h-9 px-3 rounded-xl max-w-[180px] overflow-hidden text-slate-100 hover:bg-white/10 transition-base focus-ring"
              title={`${currentOrgName}${email ? " — " + email : ""}`}
              onClick={() => router.push("/team")}
            >
              <span className="text-[10px] leading-tight font-medium truncate">{currentOrgName}</span>
              {email && (
                <span className="text-[9px] leading-tight opacity-80 truncate -mt-0.5">{email}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Drawer + overlay (fresh rebuild) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[999]">
          <div className="fixed inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

          <aside
            id="app-nav-drawer"
            className="fixed left-0 top-0 z-10 h-dvh w-[320px] max-w-[85vw] border-r border-white/10 shadow-2xl bg-slate-950"
            style={{ backgroundColor: "#020617" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <Image
                src="/demo/GeoFarm.png"
                alt="GeoFarm Logo"
                width={120}
                height={40}
                className="h-7 w-auto"
              />
              <button
                type="button"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full text-slate-100 hover:bg-white/10 transition-base focus-ring"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="p-3">
              <div className="space-y-1">
                {navTabs.map((t) => {
                  const isProjects = t.href === "/projects";
                  const active = pathname === t.href || pathname?.startsWith(t.href + "/");
                  const Icon = t.icon;

                  if (!isProjects) {
                    return (
                      <Link
                        key={t.href}
                        href={t.href}
                        className={[
                          "flex items-center gap-3 px-3 py-2 rounded-xl transition-base",
                          active ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5 hover:text-white",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "inline-flex h-9 w-9 items-center justify-center rounded-full",
                            "border border-white/10",
                            active ? "bg-white/15 text-white" : "bg-white/5 text-slate-100",
                          ].join(" ")}
                        >
                          <Icon />
                        </span>
                        <span className="font-medium">{t.label}</span>
                      </Link>
                    );
                  }

                  // Projects accordion item (in-place; no duplicate item)
                  return (
                    <div key={t.href} className="rounded-xl">
                      <button
                        type="button"
                        onClick={() => setProjectsExpanded((v) => !v)}
                        className={[
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-base",
                          active ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5 hover:text-white",
                        ].join(" ")}
                        aria-expanded={projectsExpanded}
                        aria-controls="projects-submenu"
                      >
                        <span
                          className={[
                            "inline-flex h-9 w-9 items-center justify-center rounded-full",
                            "border border-white/10",
                            active ? "bg-white/15 text-white" : "bg-white/5 text-slate-100",
                          ].join(" ")}
                        >
                          <Icon />
                        </span>

                        <span className="font-medium flex-1 text-left">{t.label}</span>

                        <span className="text-slate-300/70 text-sm">{projectsExpanded ? "▾" : "▸"}</span>
                      </button>

                      {projectsExpanded && (
                        <div id="projects-submenu" className="mt-1 ml-[52px] space-y-1">
                          {projectsChildren.map((c) => {
                            const childActive = activeProjectsChildHref === c.href;
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                className={[
                                  "block px-3 py-2 rounded-lg text-sm transition-base",
                                  childActive
                                    ? "bg-white/10 text-white"
                                    : "text-slate-200 hover:bg-white/5 hover:text-white",
                                ].join(" ")}
                                onClick={() => setDrawerOpen(false)}
                              >
                                {c.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                {email ? (
                  <div className="text-xs text-slate-300">
                    Signed in as <span className="font-medium text-slate-100">{email}</span>
                  </div>
                ) : (
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-200 hover:bg-white/5 hover:text-white transition-base"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100">
                      <IconLogin />
                    </span>
                    <span className="font-medium">Sign in</span>
                  </Link>
                )}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}