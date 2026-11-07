"use client";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { getJson, postJson } from "@/lib/api-client";

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
  refresh: () => Promise<unknown>;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const copy = useCopy();
  const [runEdited, setRunEdited] = useState(false);
  const [profileEdited, setProfileEdited] = useState(false);
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
        profile: profileEdited
          ? profile
          : { ...profile, skills: copy(profile.skills) },
        run: runEdited ? run : { ...run, name: copy(run.name) },
        completed,
        busy: false,
        refresh: async () => undefined,
        toggleSave: (id) => setSaved((items) => toggle(items, id)),
        setProfile: async (p) => {
          setProfileEdited(true);
          setProfile(p);
        },
        setRun: async (r) => {
          setRunEdited(true);
          setRun(r);
        },
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
// Uses the resilient client: a dropped connection or an HTML error page never reaches the founder as raw text.
async function fetchWorkspace(url: string): Promise<WorkspaceData> {
  const result = await getJson(url).catch(() => null);
  if (!result?.ok) {
    if (result?.status === 401) window.location.assign("/login");
    throw new Error(feedbackSource(result?.body.code, "WORKSPACE_UNAVAILABLE"));
  }
  return result.body as unknown as WorkspaceData;
}
export function WorkspaceProvider({
  initialData,
  children,
}: {
  initialData: WorkspaceData;
  children: React.ReactNode;
}) {
  const copy = useCopy();
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
      // Not re-sent: a save is not idempotent for checklist toggles.
      let result;
      try {
        result = await postJson("/api/workspace", payload);
      } catch {
        throw new Error(feedbackSource("SAVE_FAILED"));
      }
      if (!result.ok) {
        if (result.status === 401) window.location.assign("/login");
        throw new Error(feedbackSource(result.body.code));
      }
      await mutate(result.body as unknown as WorkspaceData, { revalidate: false });
    } finally {
      setBusy(false);
    }
  }
  function handleMutation(payload: unknown) {
    if (busy) return;
    void persist(payload).catch((err) =>
      toast.error(
        copy(
          err instanceof Error
            ? err.message
            : "Your change could not be saved.",
        ),
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
        refresh: () => mutate(),
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
          {copy(
            "Your workspace could not refresh. Showing your last loaded records.",
          )}
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
