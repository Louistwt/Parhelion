import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, WalletIcon } from "lucide-react";
import { ReactNode } from "react";
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
      toast.success(`${r.events} billing events (${money(r.fal_total, 3)}); updated ${r.updated} rows`);
      qc.invalidateQueries({ queryKey: ["costs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const c = q.data;
  const fmt = (v: number) => money(v);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Costs" description="Estimates are logged before each call; actual cost is filled in by syncing with fal.">
        <Button variant="outline" onClick={() => bal.refetch()} disabled={bal.isFetching}><WalletIcon /> Refresh fal balance</Button>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCwIcon className={cn(sync.isPending && "animate-spin")} /> Sync actual costs</Button>
      </PageHeader>
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {c && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <Tile label={`Spend this month (${c.month})`} value={money(c.month_spend)}>
              <Progress value={Math.min(100, c.budget_pct)} className={cn("my-1.5", c.budget_state === "over" && "[&>div]:bg-destructive", c.budget_state === "near" && "[&>div]:bg-warning")} />
              {c.budget_state === "over" ? "▲ Over budget" : c.budget_state === "near" ? "● Near budget" : "✓ Within budget"} · {c.budget_pct.toFixed(0)}% of {money(c.budget)}
            </Tile>
            <Tile label="fal balance" value={bal.data?.balance != null ? `${bal.data.balance.toFixed(2)} ${bal.data.currency}` : "—"}>
              {bal.data?.error ?? (bal.data ? "live from fal" : "click Refresh (needs FAL_ADMIN_KEY)")}
            </Tile>
            <Tile label="All-time spend" value={money(c.all_time)}>
              {c.images} images · {c.ok} requests · {c.failed ? <span className="text-destructive">{c.failed} failed</span> : "0 failed"}
            </Tile>
            <Tile label="Synced with fal" value={`${c.synced} / ${c.ok}`}>per-run cap {money(c.per_run)}</Tile>
          </div>
          <Card>
            <CardHeader><CardTitle>Spend per day (last 30 days)</CardTitle></CardHeader>
            <CardContent><DayColumns cols={c.days.cols} peak={c.days.peak} fmt={fmt} /></CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>By project</CardTitle></CardHeader><CardContent><BarList rows={c.by_project} fmt={fmt} /></CardContent></Card>
            <Card><CardHeader><CardTitle>By stage</CardTitle></CardHeader><CardContent><BarList rows={c.by_stage} fmt={fmt} /></CardContent></Card>
            <Card><CardHeader><CardTitle>By model</CardTitle></CardHeader><CardContent><BarList rows={c.by_model} fmt={fmt} /></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Forecast: cost to finish keyframes</CardTitle>
              <CardDescription>Variants per shot and reroll factor from config/pipeline.yaml; price from config/prices.yaml.</CardDescription>
            </CardHeader>
            <CardContent>
              {c.finish.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Basis</TableHead><TableHead>Model</TableHead><TableHead className="num">Images</TableHead><TableHead className="num">Estimate</TableHead></TableRow></TableHeader>
                  <TableBody>{c.finish.map((r) => (
                    <TableRow key={r.project}><TableCell>{r.project}</TableCell><TableCell className="whitespace-normal text-muted-foreground">{r.basis}</TableCell><TableCell>{r.model}</TableCell><TableCell className="num">{r.images}</TableCell><TableCell className="num">{money(r.est)}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Estimate vs actual</CardTitle></CardHeader>
            <CardContent>
              {c.est_vs_actual.length === 0 ? <p className="text-sm text-muted-foreground">Nothing synced yet (needs FAL_ADMIN_KEY).</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Model</TableHead><TableHead className="num">Requests</TableHead><TableHead className="num">Estimated</TableHead><TableHead className="num">Actual</TableHead><TableHead className="num">Difference</TableHead></TableRow></TableHeader>
                  <TableBody>{c.est_vs_actual.map((r) => (
                    <TableRow key={r.model}><TableCell className="font-mono text-xs">{r.model}</TableCell><TableCell className="num">{r.n}</TableCell><TableCell className="num">{money(r.est)}</TableCell><TableCell className="num">{money(r.actual)}</TableCell><TableCell className="num">{money(r.actual - r.est)}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent requests</CardTitle>
              <CardDescription>* estimate, not yet synced</CardDescription>
            </CardHeader>
            <CardContent>
              {c.recent.length === 0 ? <p className="text-sm text-muted-foreground">No requests logged yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Time (UTC)</TableHead><TableHead>Project</TableHead><TableHead>Stage</TableHead><TableHead>Model</TableHead><TableHead className="num">Units</TableHead><TableHead className="num">Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{c.recent.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{when(e.ts)}</TableCell><TableCell>{e.project}</TableCell><TableCell>{e.stage}</TableCell>
                      <TableCell className="font-mono text-xs">{e.model}</TableCell><TableCell className="num">{e.units}</TableCell>
                      <TableCell className="num">{money(e.cost, 3)}{e.actual_cost_usd === null && e.status === "ok" ? " *" : ""}</TableCell>
                      <TableCell title={e.note}><Badge variant={e.status === "ok" ? "success" : e.status === "failed" ? "destructive" : "secondary"}>{e.status}</Badge></TableCell>
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
