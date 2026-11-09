import { create } from "zustand";
import {
  DROPPED,
  seedOpportunities,
  seedProfile,
  seedRuns,
  type Brief,
  type Checkin,
  type Opportunity,
  type Profile,
  type Run,
  type Stance,
} from "./model";

const KEY = "venturelens-desk-v1";

type Persisted = {
  profile: Profile;
  opportunities: Opportunity[];
  runs: Run[];
  checkins: Checkin[];
};

type DeskState = Persisted & {
  hydrated: boolean;
  hydrate: () => void;
  setProfile: (patch: Partial<Profile>) => void;
  toggleSaved: (id: string) => void;
  setStatus: (id: string, status: Stance) => void;
  toggleTask: (oppId: string, taskId: string) => void;
  addInterview: (oppId: string, who: string, note: string) => void;
  addCheckin: (checkin: Checkin) => void;
  addRun: (brief: Brief) => string;
  reset: () => void;
};

function snapshot(state: DeskState): Persisted {
  return {
    profile: state.profile,
    opportunities: state.opportunities,
    runs: state.runs,
    checkins: state.checkins,
  };
}

function isPersisted(value: unknown): value is Persisted {
  if (!value || typeof value !== "object") return false;
  const v = value as Persisted;
  return Array.isArray(v.opportunities) && Array.isArray(v.runs) && !!v.profile;
}

export const useDesk = create<DeskState>((set, get) => ({
  profile: seedProfile,
  opportunities: seedOpportunities,
  runs: seedRuns,
  checkins: [],
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPersisted(parsed)) {
          set({
            profile: { ...seedProfile, ...parsed.profile },
            opportunities: parsed.opportunities,
            runs: parsed.runs.length ? parsed.runs : seedRuns,
            checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
            hydrated: true,
          });
          return;
        }
      }
    } catch {
      /* keep the seed */
    }
    set({ hydrated: true });
  },
  setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  toggleSaved: (id) =>
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === id ? { ...o, saved: !o.saved } : o,
      ),
    })),
  setStatus: (id, status) =>
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === id ? { ...o, status, saved: status === "killed" ? o.saved : true } : o,
      ),
    })),
  toggleTask: (oppId, taskId) =>
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === oppId
          ? {
              ...o,
              tasks: o.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t,
              ),
            }
          : o,
      ),
    })),
  addInterview: (oppId, who, note) =>
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === oppId
          ? {
              ...o,
              interviews: [
                {
                  id: `iv-${Date.now()}`,
                  who: who.trim(),
                  note: note.trim(),
                  at: new Date().toISOString(),
                },
                ...o.interviews,
              ],
            }
          : o,
      ),
    })),
  addCheckin: (checkin) =>
    set((s) => {
      const status: Stance | null =
        checkin.stance === "killed"
          ? "killed"
          : checkin.stance === "paused"
            ? "paused"
            : "testing";
      return {
        checkins: [checkin, ...s.checkins.filter((c) => c.week !== checkin.week)],
        opportunities: s.opportunities.map((o) =>
          o.id === checkin.opportunityId ? { ...o, status, saved: true } : o,
        ),
      };
    }),
  addRun: (brief) => {
    const id = `run-${Date.now()}`;
    const name =
      brief.goal.trim().slice(0, 64) ||
      `${brief.geography} · ${brief.craft}`.slice(0, 64);
    const run: Run = {
      id,
      name,
      createdAt: new Date().toISOString(),
      brief,
      opportunityIds: seedOpportunities.map((o) => o.id),
      dropped: [DROPPED],
    };
    set((s) => ({
      runs: [run, ...s.runs],
      profile: { ...s.profile, ...brief },
    }));
    return id;
  },
  reset: () => {
    localStorage.removeItem(KEY);
    set({
      profile: seedProfile,
      opportunities: seedOpportunities,
      runs: seedRuns,
      checkins: [],
      hydrated: true,
    });
  },
}));

export function persistDesk() {
  const state = useDesk.getState();
  if (!state.hydrated) return;
  localStorage.setItem(KEY, JSON.stringify(snapshot(state)));
}
