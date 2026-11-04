"use client";
import { createContext, useContext, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  emptyBrief,
  type Profile,
  type ResearchBrief,
  type WorkspaceData,
} from "@/lib/workspace-schema";

type WorkspaceState = {
  isDemo: boolean;
  data: WorkspaceData | null;
  saved: string[];
  toggleSave: (id: string) => void;
  profile: Profile;
  setProfile: (p: Profile) => Promise<void>;
  run: ResearchBrief;
  setRun: (r: ResearchBrief) => Promise<void>;
  completed: string[];
  toggleTask: (id: string) => void;
  href: (path: string) => string;
  busy: boolean;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState(["proposal-copilot", "customer-insights"]);
  const [profile, setProfile] = useState<Profile>({
    name: "Alex",
    role: "Aspiring founder",
    industry: "Professional services",
    skills: "Product strategy, consulting, no-code tools",
    hours: "10–20 hours",
    budget: "$1,000–5,000",
    goal: "Build a sustainable side business",
  });
  const [run, setRun] = useState<ResearchBrief>({
    name: "GenAI opportunities for service businesses",
    sector: "Professional services",
    model: "B2B subscription",
    geography: "United States",
    context: "",
  });
  const [completed, setCompleted] = useState<string[]>([]);
  const toggle = (items: string[], id: string) =>
    items.includes(id) ? items.filter((x) => x !== id) : [...items, id];
  return (
    <WorkspaceContext.Provider
      value={{
        isDemo: true,
        data: null,
        saved,
        profile,
        run,
        completed,
        busy: false,
        toggleSave: (id) => setSaved((items) => toggle(items, id)),
        setProfile: async (p) => setProfile(p),
        setRun: async (r) => setRun(r),
        toggleTask: (id) => setCompleted((items) => toggle(items, id)),
        href: (path) =>
          /^\/(dashboard|research|saved|profile|billing|onboarding|opportunities)(\/|\?|$)/.test(
            path,
          )
            ? `/demo${path}`
            : path,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
async function fetchWorkspace(url: string): Promise<WorkspaceData> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/login");
    throw new Error(result.error ?? "Unable to load your workspace.");
  }
  return result;
}
export function WorkspaceProvider({
  initialData,
  children,
}: {
  initialData: WorkspaceData;
  children: React.ReactNode;
}) {
  const {
    data = initialData,
    mutate,
    error,
  } = useSWR(
    ["/api/workspace", initialData.userId],
    ([url]) => fetchWorkspace(url),
    { fallbackData: initialData, revalidateOnMount: false },
  );
  const [busy, setBusy] = useState(false);
  const run = useMemo(
    () => data.projects[0] ?? { ...emptyBrief },
    [data.projects],
  );
  async function persist(payload: unknown) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(result.error ?? "Your change could not be saved.");
      }
      await mutate(result, { revalidate: false });
    } finally {
      setBusy(false);
    }
  }
  function handleMutation(payload: unknown) {
    if (busy) return;
    void persist(payload).catch((err) =>
      toast.error(
        err instanceof Error ? err.message : "Your change could not be saved.",
      ),
    );
  }
  return (
    <WorkspaceContext.Provider
      value={{
        isDemo: false,
        data,
        saved: data.saved,
        profile: data.profile,
        run,
        completed: data.completed,
        busy,
        href: (path) => path,
        setProfile: (profile) => persist({ action: "profile", profile }),
        setRun: (project) => persist({ action: "project", project }),
        toggleSave: (id) =>
          handleMutation({
            action: "save",
            id,
            saved: !data.saved.includes(id),
          }),
        toggleTask: (key) => {
          const separator = key.lastIndexOf("-");
          handleMutation({
            action: "task",
            id: key.slice(0, separator),
            task: key.slice(separator + 1),
            completed: !data.completed.includes(key),
          });
        },
      }}
    >
      {error && (
        <p
          role="alert"
          className="border-b bg-secondary p-4 text-center text-sm text-foreground"
        >
          Your workspace could not refresh. Showing your last loaded records.
        </p>
      )}
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}
export function useDemo() {
  const state = useOptionalWorkspace();
  if (!state) throw new Error("A workspace provider is required.");
  return state;
}
