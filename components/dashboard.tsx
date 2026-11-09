"use client";
import dynamic from "next/dynamic";
import { useDemo } from "@/components/demo-provider";
import { LiveDashboard } from "@/components/live-workspace";

// The demo dashboard carries the synthetic fixtures and the score chart (recharts). Loading it only when the demo
// renders keeps both out of every live workspace page.
const DemoDashboard = dynamic(() => import("@/components/demo-dashboard").then((m) => m.DemoDashboard));

export function Dashboard() {
  const { isDemo } = useDemo();
  return isDemo ? <DemoDashboard /> : <LiveDashboard />;
}
