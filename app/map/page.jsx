import { Suspense } from "react";
import HoleMapWorkspace from "./HoleMapWorkspace";

export default function MapPage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return (
    <div className="overflow-x-hidden md:-mt-[72px]">
      <Suspense fallback={<div className="max-w-6xl mx-auto p-6">Loading…</div>}>
        <HoleMapWorkspace publicToken={publicToken} />
      </Suspense>
    </div>
  );
}
