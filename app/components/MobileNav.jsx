"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCore, IconAdmin, IconTeam, IconUser } from "./icons";

const tabs = [
  { href: "/core", label: "Core", icon: IconAdmin },
  { href: "/admin", label: "Add Holes/Tasks", icon: IconCore },
  { href: "/team", label: "Team", icon: IconTeam },
  { href: "/user", label: "Me", icon: IconUser },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
  className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-gradient-to-r from-indigo-50 via-indigo-100 to-purple-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = pathname?.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
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
