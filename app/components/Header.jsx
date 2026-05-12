"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import {
  IconCore,
  IconDrillholeViz,
  IconAdmin,
  IconTeam,
  IconUser,
  IconLogin,
  IconReport,
  IconClipboard,
  IconCoreTasks,
  IconMap,
  IconWorkflow,
  AssetIcon,
  IconPlods,
} from "./icons";

export function WorkMineLogo({ compact = false }) {
  return (
    <span className="inline-flex items-center">
      <span className="flex min-w-0 flex-col leading-none">
        <span className="flex items-end">
          <span
            className={[
              "bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_48%,#67e8f9_100%)] bg-clip-text font-black uppercase tracking-[-0.065em] text-transparent",
              compact ? "text-[1.04rem]" : "text-[1.18rem]",
            ].join(" ")}
          >
            WorkMine
          </span>
        </span>
        <span
          className={[
            "mt-1.5 uppercase tracking-[0.26em] text-slate-400",
            compact ? "text-[0.39rem]" : "text-[0.44rem]",
          ].join(" ")}
        >
          MINE OPS PLATFORM
        </span>
      </span>
    </span>
  );
}

export default function Header() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const headerGlassStyle = useMemo(
    () => ({
      background:
        "linear-gradient(180deg, rgba(2, 6, 23, 0.68) 0%, rgba(2, 6, 23, 0.52) 100%)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(22px) saturate(150%)",
      WebkitBackdropFilter: "blur(22px) saturate(150%)",
      boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
    }),
    []
  );

  const [email, setEmail] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [userId, setUserId] = useState(null);
  const { orgId, memberships, currentOrgName: contextOrgName, isAnonymousDemo } = useOrg();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  const openDrawer = () => {
    setDrawerMounted(true);
    window.requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

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
    closeDrawer();
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen || !drawerMounted) return;

    const timer = window.setTimeout(() => {
      setDrawerMounted(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [drawerOpen, drawerMounted]);

  useEffect(() => {
    if (!drawerMounted) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeDrawer();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerMounted]);

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
    if (contextOrgName) return contextOrgName;
    if (!orgId) return null;
    const m = memberships.find((m) => m.organization_id === orgId);
    return m?.organizations?.name || null;
  }, [contextOrgName, orgId, memberships]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return;
    }

    closeDrawer();
    router.replace("/");
  };

  const navTabs = [
    { href: "/map", label: "Map", icon: IconMap },
    { href: "/dashboard", label: "Reports", icon: IconReport },
    { href: "/activity", label: "Activity", icon: IconClipboard },
    { href: "/coretasks", label: "Drilling", icon: IconCoreTasks },
    { href: "/drillhole-viz", label: "Drillhole Viz", icon: IconDrillholeViz },
    { href: "/consumables", label: "Consumables", icon: IconCore },
    { href: "/projects", label: "Projects", icon: IconClipboard },
    { href: "/workflows", label: "Workflow Studio", icon: IconWorkflow },
    { href: "/assets", label: "Assets", icon: AssetIcon },
    { href: "/plods", label: "Plods", icon: IconPlods },
    ...(!isAnonymousDemo ? [{ href: "/team", label: "Team", icon: IconTeam }] : []),
    { href: "/how-to", label: "How To", icon: IconClipboard },
    ...(isAppAdmin && !isAnonymousDemo ? [{ href: "/admin", label: "AppAdmin", icon: IconAdmin }] : []),
  ];

  const activeProjectsChildHref = useMemo(() => {
    if (pathname !== "/projects") return null;
    const t = searchParams.get("tab") || "projects";
    return `/projects?tab=${t}`;
  }, [pathname, searchParams]);

  return (
    <header className="frosted-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]" style={headerGlassStyle}>
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Burger */}
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg shadow-black/30 text-slate-100 hover:border-white/30 hover:bg-white/15 active:scale-95 transition-base focus-ring"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="app-nav-drawer"
            onClick={openDrawer}
          >
            {/* hamburger icon (3 lines only) */}
            <span aria-hidden="true" className="flex flex-col justify-center gap-1.5">
              <span className="block h-[2px] w-4.5 rounded-full bg-current" />
              <span className="block h-[2px] w-4.5 rounded-full bg-current" />
              <span className="block h-[2px] w-4.5 rounded-full bg-current" />
            </span>
          </button>

          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link className="flex items-center" href="/map" aria-label="WorkMine home">
              <WorkMineLogo />
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
              onClick={() => router.push(isAnonymousDemo ? "/?mode=signup" : "/team")}
            >
              <span className="text-[10px] leading-tight font-medium truncate">{currentOrgName}</span>
              {email ? (
                <span className="text-[9px] leading-tight opacity-80 truncate -mt-0.5">{email}</span>
              ) : isAnonymousDemo ? (
                <span className="text-[9px] leading-tight opacity-80 truncate -mt-0.5">Public demo</span>
              ) : null}
            </button>
          )}
        </div>
      </div>

      {/* Drawer + overlay (fresh rebuild) */}
      {drawerMounted && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[999]">
              <div
                className={[
                  "fixed inset-0 bg-black/70 transition-opacity duration-300",
                  drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none",
                ].join(" ")}
                onClick={closeDrawer}
                aria-hidden="true"
              />

              <aside
                id="app-nav-drawer"
                className={[
                  "fixed left-0 top-0 z-10 flex h-dvh w-[272px] max-w-[72vw] flex-col border-r border-white/10 shadow-2xl bg-slate-950",
                  "transform transition-transform duration-300 ease-out will-change-transform",
                  drawerOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                style={{ backgroundColor: "#020617" }}
                role="dialog"
                aria-modal="true"
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <Link href="/map" className="flex items-center" onClick={closeDrawer} aria-label="WorkMine home">
                    <WorkMineLogo compact />
                  </Link>
                  <button
                    type="button"
                    className="h-10 w-10 inline-flex items-center justify-center rounded-full text-slate-100 hover:bg-white/10 transition-base focus-ring"
                    aria-label="Close menu"
                    onClick={closeDrawer}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0">
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
                              "flex items-center gap-3 px-3 py-2 rounded-xl text-[0.7rem] transition-base",
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
                            <span className="font-medium leading-5">{t.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <div key={t.href} className="rounded-xl">
                          <button
                            type="button"
                            onClick={() => setProjectsExpanded((v) => !v)}
                            className={[
                              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[0.7rem] transition-base",
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

                            <span className="font-medium flex-1 text-left leading-5">{t.label}</span>

                            <span className="text-slate-300/70 text-[0.7rem]">{projectsExpanded ? "▾" : "▸"}</span>
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
                                      "block px-3 py-2 rounded-lg text-[0.7rem] transition-base",
                                      childActive
                                        ? "bg-white/10 text-white"
                                        : "text-slate-200 hover:bg-white/5 hover:text-white",
                                    ].join(" ")}
                                    onClick={closeDrawer}
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
                      <div className="space-y-2">
                        <div className="px-3 text-[0.6rem] text-slate-300">
                          Signed in as <span className="font-medium text-slate-100">{email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[0.7rem] text-slate-200 hover:bg-white/5 hover:text-white transition-base"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100">
                            <IconLogin />
                          </span>
                          <span className="font-medium leading-5">Sign out</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isAnonymousDemo ? <div className="px-3 text-[0.55rem] uppercase tracking-[0.18em] text-amber-200/80">Browsing public demo</div> : null}
                        <Link
                          href="/?mode=signin"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[0.7rem] text-slate-200 hover:bg-white/5 hover:text-white transition-base"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100">
                            <IconLogin />
                          </span>
                          <span className="font-medium leading-5">Sign in</span>
                        </Link>
                        <Link
                          href="/?mode=signup"
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-[0.7rem] text-slate-200 hover:bg-white/5 hover:text-white transition-base"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-100">
                            <IconUser />
                          </span>
                          <span className="font-medium leading-5">Create account</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </nav>
              </aside>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}