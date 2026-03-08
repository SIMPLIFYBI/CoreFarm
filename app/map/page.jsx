import HoleMapWorkspace from "./HoleMapWorkspace";

export default function MapPage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const serverTokenPresent = String(publicToken).trim().length > 0;

  return <HoleMapWorkspace publicToken={publicToken} serverTokenPresent={serverTokenPresent} />;
}
