import { useMutation } from "@tanstack/react-query";
import { SearchCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "../api";
import { ErrorBox, Loading, PageHeader } from "../components/common";
import { useMoney, useSettings } from "../format";

type CheckRow = { endpoint: string; ours: number | null; fal: number | null; unit: string | null; match: boolean };

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <Table>
      <TableBody>{rows.map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="num">{v}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

export function SettingsPage() {
  const q = useSettings();
  const money = useMoney();
  const check = useMutation({ mutationFn: () => api.post<{ rows: CheckRow[] }>("/api/prices/check") });
  const s = q.data;
  if (q.isLoading) return <Loading />;
  if (q.error || !s) return <ErrorBox error={q.error} />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description={<>Read-only. Change values in <code>.env</code> and <code>config/*.yaml</code>, then refresh.</>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Budget & keys (.env)</CardTitle><CardDescription className="font-mono text-xs">{s.root}</CardDescription></CardHeader>
          <CardContent>
            <KV rows={[
              ["Max spend per run", money(s.max_spend_per_run)],
              ["Monthly budget", money(s.monthly_budget)],
              ["Display currency", s.currency],
              ["FAL_KEY", s.has_fal_key ? <Badge variant="success">set</Badge> : <Badge variant="destructive">missing</Badge>],
              ["FAL_ADMIN_KEY (cost sync, balance)", s.has_fal_admin_key ? <Badge variant="success">set</Badge> : <Badge variant="warning">missing</Badge>],
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pipeline (config/pipeline.yaml)</CardTitle></CardHeader>
          <CardContent>
            <KV rows={[
              ["Keyframe variants per shot", s.pipeline.keyframes.variants_per_shot],
              ["Reroll factor (forecast)", s.pipeline.keyframes.reroll_factor],
              ["Character sheet variants", s.pipeline.characters.variants],
              ["USD → HKD", s.pipeline.report.usd_to_hkd],
            ]} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Image models (config/models.yaml)</CardTitle><CardDescription>The first entry is the default.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Text endpoint</TableHead><TableHead>Edit endpoint (with references)</TableHead><TableHead>Verified</TableHead></TableRow></TableHeader>
            <TableBody>{s.models.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">{m.key}</TableCell>
                <TableCell className="font-mono text-xs">{m.text_endpoint}</TableCell>
                <TableCell className="font-mono text-xs">{m.edit_endpoint}</TableCell>
                <TableCell>{m.verified ? <Badge variant="success">{m.verified}</Badge> : <Badge variant="warning">no</Badge>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Prices (config/prices.yaml)</CardTitle>
          <CardAction><Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending || !s.has_fal_key}><SearchCheckIcon /> {check.isPending ? "Checking…" : "Check against fal"}</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ErrorBox error={check.error} />
          <Table>
            <TableHeader><TableRow><TableHead>Endpoint</TableHead><TableHead className="num">Our price</TableHead><TableHead>Unit</TableHead><TableHead>Verified</TableHead>{check.data && <TableHead className="num">fal now</TableHead>}</TableRow></TableHeader>
            <TableBody>{Object.entries(s.prices).map(([ep, p]) => {
              const live = check.data?.rows.find((r) => r.endpoint === ep);
              return (
                <TableRow key={ep}>
                  <TableCell className="font-mono text-xs">{ep}</TableCell><TableCell className="num">${p.unit_price}</TableCell><TableCell>{p.unit}</TableCell>
                  <TableCell>{p.verified ?? <Badge variant="warning">no</Badge>}</TableCell>
                  {check.data && <TableCell className="num">{live ? (live.fal == null ? <Badge variant="warning">not found</Badge> : <Badge variant={live.match ? "success" : "destructive"}>${live.fal}</Badge>) : "—"}</TableCell>}
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
