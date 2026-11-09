"use client";
import dynamic from "next/dynamic";
import { useDemo } from "@/components/demo-provider";
import { LiveResearchResults } from "@/components/live-workspace";

// The demo results view localizes the synthetic fixtures; live pages never load it.
const DemoResearchResults = dynamic(() =>
  import("@/components/demo-research-results").then((m) => m.DemoResearchResults),
);

export function ResearchResults({ savedOnly = false }: { savedOnly?: boolean }) {
  const { isDemo } = useDemo();
  return isDemo ? <DemoResearchResults savedOnly={savedOnly} /> : <LiveResearchResults savedOnly={savedOnly} />;
}
