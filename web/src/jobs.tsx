import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useState } from "react";
import { api, Job } from "./api";

type Ctx = { get: (scope: string) => string | null; set: (scope: string, id: string | null) => void };
const JobsCtx = createContext<Ctx>({ get: () => null, set: () => {} });

export function JobsProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, string | null>>({});
  return (
    <JobsCtx.Provider value={{ get: (s) => map[s] ?? null, set: (s, id) => setMap((m) => ({ ...m, [s]: id })) }}>
      {children}
    </JobsCtx.Provider>
  );
}

/** The job to show for a scope: the one started from this screen, or any still-running job for it. */
export function useScopeJob(scope: string, match: (j: Job) => boolean) {
  const ctx = useContext(JobsCtx);
  const list = useQuery({ queryKey: ["jobs"], queryFn: () => api.get<{ jobs: Job[] }>("/api/jobs"), refetchInterval: 5000 });
  const explicit = ctx.get(scope);
  const running = list.data?.jobs.find((j) => match(j) && (j.status === "running" || j.status === "queued"));
  const dismissed = explicit === "";
  const id = explicit || (dismissed ? null : running?.id ?? null);
  return { jobId: id, setJob: (jid: string | null) => ctx.set(scope, jid ?? "") };
}
