"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { IconCore, IconAdmin, IconTeam, IconUser, IconReport, IconClipboard, IconCoreTasks, IconMap, AssetIcon, IconPlods } from "./icons";

const tabs = [
  { href: "/map-mobile", label: "Map", icon: IconMap },
  { href: "/dashboard", label: "Reports", icon: IconReport },
  { href: "/activity", label: "Activity", icon: IconClipboard },
  { href: "/plods", label: "Plods", icon: IconPlods },
  { href: "/coretasks", label: "Core Tasks", icon: IconCoreTasks },
  { href: "/drillhole-viz", label: "Drillhole Viz", icon: IconCore },
  { href: "/consumables", label: "Consumables", icon: IconCore },
  { href: "/projects", label: "Projects", icon: IconClipboard },
  { href: "/assets", label: "Assets", icon: AssetIcon },
  { href: "/team", label: "Team", icon: IconTeam },
];

export default function MobileNav() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const pathname = usePathname();
  const [isAppAdmin, setIsAppAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
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
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const visibleTabs = isAppAdmin ? [...tabs, { href: "/admin", label: "AppAdmin", icon: IconAdmin }] : tabs;

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 px-2 pb-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(3,15,28,0.98))] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-24 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_65%)]" />
          <ul className="relative flex gap-1 overflow-x-auto no-scrollbar px-2 py-2" style={{ WebkitOverflowScrolling: "touch" }}>
        {visibleTabs.map((t) => {
          const active = pathname?.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-none w-[84px]">
              <Link
                href={t.href}
                className={
                  [
                    "group flex min-h-[72px] flex-col items-center justify-center rounded-[24px] border px-2 py-2.5 text-center transition duration-200",
                    active
                      ? "border-cyan-300/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(8,47,73,0.28))] text-cyan-100 shadow-[0_14px_34px_rgba(34,211,238,0.18)]"
                      : "border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200",
                  ].join(" ")
                }
              >
                <span
                  className={[
                    "mb-1.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                    active
                      ? "border-cyan-200/30 bg-[linear-gradient(135deg,#22d3ee,#0891b2)] text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.32)]"
                      : "border-white/10 bg-white/[0.05] text-slate-200 group-hover:border-white/15 group-hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  <Icon />
                </span>
                <span className={"text-[11px] font-medium tracking-[0.01em] " + (active ? "text-cyan-100" : "text-slate-300")}>{t.label}</span>
              </Link>
            </li>
          );
        })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
