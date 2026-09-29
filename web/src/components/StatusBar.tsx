import { useQuery } from "@tanstack/react-query";
import { KeyRoundIcon, LaptopIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, Job, Overview } from "../api";
import { useMoney } from "../format";
import { LANGS, setLang } from "../i18n";
import { ThemeToggle } from "./theme";

/** VS Code-style status bar: global state that should always be visible (DESIGN.md → Layout). */
export function StatusBar() {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const ov = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview"), refetchInterval: 5000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api.get<{ jobs: Job[] }>("/api/jobs"), refetchInterval: 5000 });
  const o = ov.data;
  const job = jobs.data?.jobs.find((j) => j.status === "running" || j.status === "queued");
  const pct = o && o.monthly_budget ? Math.min(100, (100 * o.month_spend) / o.monthly_budget) : 0;
  const kind = job ? (t(`shell.jobKinds.${job.kind}` as never, { defaultValue: job.kind }) as string) : "";
  return (
    <footer
      aria-label={t("shell.statusBar.label")}
      className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-sidebar px-4 py-1.5 text-xs text-muted-foreground"
    >
      {o && (
        <span className="flex items-center gap-2">
          {t("shell.statusBar.month")}
          <b className="font-mono font-medium text-foreground tabular-nums">{money(o.month_spend)} / {money(o.monthly_budget, 0)}</b>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
            <span className={cn("block h-full rounded-full", pct >= 80 ? "bg-warning" : "bg-spend")} style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
      {job && (
        <span className="flex items-center gap-1.5 text-foreground">
          <LoaderCircleIcon className="size-3.5 animate-spin text-primary-mark" aria-hidden />
          {job.status === "queued"
            ? t("shell.statusBar.jobQueued", { kind })
            : t("shell.statusBar.job", { kind, done: job.progress.done, total: job.progress.total })}
        </span>
      )}
      {o && !o.has_fal_key && (
        <span className="flex items-center gap-1.5 font-medium text-destructive"><KeyRoundIcon className="size-3.5" aria-hidden />{t("shell.statusBar.falMissing")}</span>
      )}
      <span className="ml-auto flex items-center gap-3">
        <span className="flex gap-0.5 rounded-md border bg-background p-0.5" role="group" aria-label={t("shell.statusBar.language")}>
          {LANGS.map((l) => (
            <Button key={l.code} size="xs" variant={i18n.language === l.code ? "secondary" : "ghost"} aria-pressed={i18n.language === l.code}
              lang={l.code} title={l.label} onClick={() => setLang(l.code)}>
              {l.short}
            </Button>
          ))}
        </span>
        <ThemeToggle />
        <span className="hidden items-center gap-1.5 sm:flex" title={t("shell.statusBar.localTitle")}>
          <LaptopIcon className="size-3.5" aria-hidden />{t("shell.statusBar.local")}
        </span>
      </span>
    </footer>
  );
}
