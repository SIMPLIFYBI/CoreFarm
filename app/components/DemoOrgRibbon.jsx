"use client";

import { useOrg } from "@/lib/OrgContext";

export default function DemoOrgRibbon() {
  const { isDemoOrg } = useOrg();

  if (!isDemoOrg) return null;

  return (
    <div className="pointer-events-none fixed right-[-4.5rem] top-[calc(env(safe-area-inset-top)+0.8rem)] z-[70] rotate-45 select-none md:right-[-3.85rem] md:top-[calc(env(safe-area-inset-top)+0.4rem)]">
      <div className="min-w-[12.6rem] border border-amber-100/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.96),rgba(217,119,6,0.96))] px-9 py-2 text-center shadow-[0_18px_44px_rgba(120,53,15,0.35)] md:min-w-[13.5rem] md:px-10 md:py-2.5">
        <div className="text-[9px] font-bold uppercase leading-none tracking-[0.3em] text-amber-950/90 md:text-[10px]">Demo Org</div>
        <div className="hidden pt-1 text-[9px] font-medium leading-none tracking-[0.08em] text-amber-950/75 md:block">Sample workspace</div>
      </div>
    </div>
  );
}