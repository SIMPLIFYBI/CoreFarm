import HoleMapWorkspace from "./HoleMapWorkspace";

export default function MapPage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return <HoleMapWorkspace publicToken={publicToken} />;
}
