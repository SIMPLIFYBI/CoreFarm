"use client";

import { Suspense } from "react";
import ProjectsView from "./components/ProjectsView";

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6">Loading…</div>}>
      <ProjectsView />
    </Suspense>
  );
}
