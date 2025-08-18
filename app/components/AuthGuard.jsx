"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

const PUBLIC_PATHS = new Set(["/", "/auth", "/register"]);

export default function AuthGuard({ children }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Allow public paths and Next.js internals/assets
      if (
        PUBLIC_PATHS.has(pathname) ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/public") ||
        pathname.startsWith("/api")
      ) {
        setChecked(true);
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data?.user) {
        router.replace("/");
      } else {
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, router, pathname]);

  if (!checked && !PUBLIC_PATHS.has(pathname)) {
    return null;
  }
  return children;
}
