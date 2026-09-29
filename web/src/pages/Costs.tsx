import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, WalletIcon } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api, Costs as CostsT } from "../api";
import { BarList, DayColumns } from "../components/charts";
import { ErrorBox, Loading, PageHeader } from "../components/common";
import { useMoney, when } from "../format";

function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

export function Costs() {
  const { t } = useTranslation();
  const money = useMoney();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["costs"], queryFn: () => api.get<CostsT>("/api/costs") });
  const bal = useQuery({
    queryKey: ["balance"],
    queryFn: () => api.get<{ balance: number | null; currency?: string; error: string | null }>("/api/balance"),
    enabled: false,
  });
  const sync = useMutation({
    mutationFn: () => api.post<{ events: number; updated: number; fal_total: number }>("/api/costs/sync"),
    onSuccess: (r) => {
      toast.success(t("costs.synced", { events: r.events, total: money(r.fal_total, 3), updated: r.updated }));
      qc.invalidateQueries({ queryKey: ["costs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const c = q.data;
  const fmt = (v: number) => money(v);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("costs.title")} description={t("costs.description")}>
        <Button variant="outline" onClick={() => bal.refetch()} disabled={bal.isFetching}><WalletIcon /> {t("costs.refreshBalance")}</Button>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCwIcon className={cn(sync.isPending && "animate-spin")} /> {t("costs.sync")}</Button>
      </PageHeader>
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {c && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <Tile label={t("costs.tiles.month", { month: c.month })} value={money(c.month_spend)}>
              <Progress value={Math.min(100, c.budget_pct)} className={cn("my-1.5", c.budget_state === "over" && "[&>div]:bg-destructive", c.budget_state === "near" && "[&>div]:bg-warning")} />
              {t(c.budget_state === "over" ? "costs.tiles.over" : c.budget_state === "near" ? "costs.tiles.near" : "costs.tiles.within")} · {t("costs.tiles.ofBudget", { pct: c.budget_pct.toFixed(0), amount: money(c.budget) })}
            </Tile>
            <Tile label={t("costs.tiles.balance")} value={bal.data?.balance != null ? `${bal.data.balance.toFixed(2)} ${bal.data.currency}` : "—"}>
              {bal.data?.error ?? (bal.data ? t("costs.tiles.balanceLive") : t("costs.tiles.balanceHint"))}
            </Tile>
            <Tile label={t("costs.tiles.allTime")} value={money(c.all_time)}>
              {t("costs.tiles.images", { n: c.images })} · {t("costs.tiles.requests", { n: c.ok })} · {c.failed ? <span className="text-destructive">{t("costs.tiles.failed", { n: c.failed })}</span> : t("costs.tiles.failed", { n: 0 })}
            </Tile>
            <Tile label={t("costs.tiles.syncedWithFal")} value={`${c.synced} / ${c.ok}`}>{t("costs.tiles.perRunCap", { amount: money(c.per_run) })}</Tile>
          </div>
          <Card>
            <CardHeader><CardTitle>{t("costs.perDay")}</CardTitle></CardHeader>
            <CardContent><DayColumns cols={c.days.cols} peak={c.days.peak} fmt={fmt} /></CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>{t("costs.byProject")}</CardTitle></CardHeader><CardContent><BarList rows={c.by_project} fmt={fmt} /></CardContent></Card>
            <Card><CardHeader><CardTitle>{t("costs.byStage")}</CardTitle></CardHeader><CardContent><BarList rows={c.by_stage} fmt={fmt} /></CardContent></Card>
            <Card><CardHeader><CardTitle>{t("costs.byModel")}</CardTitle></CardHeader><CardContent><BarList rows={c.by_model} fmt={fmt} /></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("costs.forecast.title")}</CardTitle>
              <CardDescription>{t("costs.forecast.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {c.finish.length === 0 ? <p className="text-sm text-muted-foreground">{t("costs.forecast.empty")}</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>{t("costs.cols.project")}</TableHead><TableHead>{t("costs.cols.basis")}</TableHead><TableHead>{t("costs.cols.model")}</TableHead><TableHead className="num">{t("costs.cols.images")}</TableHead><TableHead className="num">{t("costs.cols.estimate")}</TableHead></TableRow></TableHeader>
                  <TableBody>{c.finish.map((r) => (
                    <TableRow key={r.project}><TableCell>{r.project}</TableCell><TableCell className="whitespace-normal text-muted-foreground">{r.basis}</TableCell><TableCell>{r.model}</TableCell><TableCell className="num">{r.images}</TableCell><TableCell className="num">{money(r.est)}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("costs.estVsActual.title")}</CardTitle></CardHeader>
            <CardContent>
              {c.est_vs_actual.length === 0 ? <p className="text-sm text-muted-foreground">{t("costs.estVsActual.empty")}</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>{t("costs.cols.model")}</TableHead><TableHead className="num">{t("costs.cols.requests")}</TableHead><TableHead className="num">{t("costs.cols.estimated")}</TableHead><TableHead className="num">{t("costs.cols.actual")}</TableHead><TableHead className="num">{t("costs.cols.difference")}</TableHead></TableRow></TableHeader>
                  <TableBody>{c.est_vs_actual.map((r) => (
                    <TableRow key={r.model}><TableCell className="font-mono text-xs">{r.model}</TableCell><TableCell className="num">{r.n}</TableCell><TableCell className="num">{money(r.est)}</TableCell><TableCell className="num">{money(r.actual)}</TableCell><TableCell className="num">{money(r.actual - r.est)}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("costs.recent.title")}</CardTitle>
              <CardDescription>{t("costs.recent.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              {c.recent.length === 0 ? <p className="text-sm text-muted-foreground">{t("costs.recent.empty")}</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>{t("costs.cols.time")}</TableHead><TableHead>{t("costs.cols.project")}</TableHead><TableHead>{t("costs.cols.stage")}</TableHead><TableHead>{t("costs.cols.model")}</TableHead><TableHead className="num">{t("costs.cols.units")}</TableHead><TableHead className="num">{t("costs.cols.cost")}</TableHead><TableHead>{t("costs.cols.status")}</TableHead></TableRow></TableHeader>
                  <TableBody>{c.recent.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{when(e.ts)}</TableCell><TableCell>{e.project}</TableCell><TableCell>{e.stage}</TableCell>
                      <TableCell className="font-mono text-xs">{e.model}</TableCell><TableCell className="num">{e.units}</TableCell>
                      <TableCell className="num">{money(e.cost, 3)}{e.actual_cost_usd === null && e.status === "ok" ? " *" : ""}</TableCell>
                      <TableCell title={e.note}><Badge variant={e.status === "ok" ? "success" : e.status === "failed" ? "destructive" : "info"}>{e.status === "ok" ? t("costs.statuses.ok") : e.status === "failed" ? t("costs.statuses.failed") : e.status}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
