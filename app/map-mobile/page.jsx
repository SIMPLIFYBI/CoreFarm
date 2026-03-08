import MobileHoleMapWorkspace from "./MobileHoleMapWorkspace";

export default function MapMobilePage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const serverTokenPresent = String(publicToken).trim().length > 0;

  return <MobileHoleMapWorkspace publicToken={publicToken} serverTokenPresent={serverTokenPresent} />;
}
