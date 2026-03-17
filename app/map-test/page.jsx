import MapboxTestWorkspace from "./MapboxTestWorkspace";

export default function MapTestPage() {
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  return <MapboxTestWorkspace publicToken={publicToken} />;
}
