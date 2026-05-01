"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { isPublicDemoEnabled, isPublicDemoRoute } from "@/lib/demoMode";

const PUBLIC_PATHS = new Set(["/"]);

export default function AuthGuard({ children }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Allow public paths and Next.js internals/assets
      const allowAnonymousDemoRoute = isPublicDemoEnabled() && isPublicDemoRoute(pathname);
      if (
        PUBLIC_PATHS.has(pathname) ||
        allowAnonymousDemoRoute ||
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

  if (!checked && !PUBLIC_PATHS.has(pathname) && !(isPublicDemoEnabled() && isPublicDemoRoute(pathname))) {
    return null;
  }
  return children;
}
