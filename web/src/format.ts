import { useQuery } from "@tanstack/react-query";
import { api, Settings } from "./api";

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<Settings>("/api/settings"), staleTime: 60_000 });
}

/** Money formatter in the display currency from .env (USD or HKD). Values are always stored in USD. */
export function useMoney() {
  const { data } = useSettings();
  const currency = data?.currency ?? "USD";
  const rate = data?.pipeline.report.usd_to_hkd ?? 7.8;
  return (usd: number, digits = 2) =>
    currency === "HKD" ? `HK$${(usd * rate).toFixed(digits)}` : `$${usd.toFixed(digits)}`;
}

export const secs = (s: number) => `${s.toFixed(1)}s`;

export const when = (iso: string) => iso.replace("T", " ").slice(0, 16);

export const STAGE_ORDER = ["brief", "script", "voice", "timing", "shotlist", "keyframes", "storyboard", "clips", "video"] as const;
