import MobileHoleMapWorkspace from "./MobileHoleMapWorkspace";

export default function MapMobilePage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return <MobileHoleMapWorkspace publicToken={publicToken} />;
}
