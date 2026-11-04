"use client";
import { createContext, useContext, useState } from "react";
type Profile = {
  name: string;
  role: string;
  industry: string;
  skills: string;
  hours: string;
  budget: string;
  goal: string;
};
type Run = { name: string; sector: string; model: string; geography: string };
type DemoState = {
  saved: string[];
  toggleSave: (id: string) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  run: Run;
  setRun: (r: Run) => void;
  completed: string[];
  toggleTask: (id: string) => void;
};
const DemoContext = createContext<DemoState | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<string[]>([
    "proposal-copilot",
    "customer-insights",
  ]);
  const [profile, setProfile] = useState<Profile>({
    name: "Alex",
    role: "Aspiring founder",
    industry: "Professional services",
    skills: "Product strategy, consulting, no-code tools",
    hours: "10–20 hours",
    budget: "$1,000–5,000",
    goal: "Build a sustainable side business",
  });
  const [run, setRun] = useState<Run>({
    name: "GenAI opportunities for service businesses",
    sector: "Professional services",
    model: "B2B subscription",
    geography: "United States",
  });
  const [completed, setCompleted] = useState<string[]>([]);
  return (
    <DemoContext.Provider
      value={{
        saved,
        toggleSave: (id) =>
          setSaved((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
          ),
        profile,
        setProfile,
        run,
        setRun,
        completed,
        toggleTask: (id) =>
          setCompleted((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
          ),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("DemoProvider is required");
  return ctx;
}
