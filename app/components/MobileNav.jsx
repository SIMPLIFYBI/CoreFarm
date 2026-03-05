"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { IconCore, IconAdmin, IconTeam, IconUser, IconReport, IconClipboard, IconCoreTasks, AssetIcon, IconPlods } from "./icons";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: IconReport },
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
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex gap-1 overflow-x-auto no-scrollbar px-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {visibleTabs.map((t) => {
          const active = pathname?.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-none w-20">
              <Link
                href={t.href}
                className={
                  "flex flex-col items-center justify-center py-2 text-xs " +
                  (active ? "text-indigo-600" : "text-gray-600")
                }
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white mb-0.5">
                  <Icon />
                </span>
                <span className="text-[11px]">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
