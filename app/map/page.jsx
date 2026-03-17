import HoleMapWorkspace from "./HoleMapWorkspace";

export default function MapPage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return (
    <div className="overflow-x-hidden md:-mt-[72px]">
      <HoleMapWorkspace publicToken={publicToken} />
    </div>
  );
}
