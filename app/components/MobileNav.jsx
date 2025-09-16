"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCore, IconAdmin, IconTeam, IconUser, IconReport, IconClipboard, IconCoreTasks, AssetIcon, IconPlods } from "./icons";

const tabs = [
  { href: "/user", label: "Dashboard", icon: IconReport },
  { href: "/plods", label: "Plods", icon: IconPlods },
  { href: "/home", label: "Preview", icon: IconReport },
  { href: "/coretasks", label: "Core Tasks", icon: IconCoreTasks },
  { href: "/consumables", label: "Consumables", icon: IconCore },
  { href: "/projects", label: "Projects", icon: IconClipboard },
  { href: "/assets", label: "Assets", icon: AssetIcon },
  { href: "/team", label: "Team", icon: IconTeam },
];

// Add a small logo link as the first item so tapping the logo goes to preview
export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-gradient-to-r from-indigo-50 via-indigo-100 to-purple-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex gap-1 overflow-x-auto no-scrollbar px-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* Logo item that navigates to the Preview page */}
        <li key="logo" className="flex-none w-20">
          <Link
            href="/home"
            className={
              "flex flex-col items-center justify-center py-2 text-xs " +
              (pathname?.startsWith("/home") ? "text-indigo-600" : "text-gray-600")
            }
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white mb-0.5">
              <img src="/demo/GeoFarm.png" alt="Logo" className="h-6 w-auto rounded" />
            </span>
            <span className="text-[11px]">Preview</span>
          </Link>
        </li>

        {tabs.map((t) => {
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
