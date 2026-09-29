import { useMutation } from "@tanstack/react-query";
import { SearchCheckIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const q = useSettings();
  const money = useMoney();
  const check = useMutation({ mutationFn: () => api.post<{ rows: CheckRow[] }>("/api/prices/check") });
  const s = q.data;
  if (q.isLoading) return <Loading />;
  if (q.error || !s) return <ErrorBox error={q.error} />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} description={<Trans i18nKey="settings.description" components={[<code />, <code />]} />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("settings.budget.title")}</CardTitle><CardDescription className="font-mono text-xs">{s.root}</CardDescription></CardHeader>
          <CardContent>
            <KV rows={[
              [t("settings.budget.maxPerRun"), money(s.max_spend_per_run)],
              [t("settings.budget.monthly"), money(s.monthly_budget)],
              [t("settings.budget.currency"), s.currency],
              ["FAL_KEY", s.has_fal_key ? <Badge variant="success">{t("settings.set")}</Badge> : <Badge variant="destructive">{t("settings.missing")}</Badge>],
              [t("settings.budget.adminKey"), s.has_fal_admin_key ? <Badge variant="success">{t("settings.set")}</Badge> : <Badge variant="warning">{t("settings.missing")}</Badge>],
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("settings.pipeline.title")}</CardTitle></CardHeader>
          <CardContent>
            <KV rows={[
              [t("settings.pipeline.keyframeVariants"), s.pipeline.keyframes.variants_per_shot],
              [t("settings.pipeline.reroll"), s.pipeline.keyframes.reroll_factor],
              [t("settings.pipeline.sheetVariants"), s.pipeline.characters.variants],
              [t("settings.pipeline.usdToHkd"), s.pipeline.report.usd_to_hkd],
            ]} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("settings.models.title")}</CardTitle><CardDescription>{t("settings.models.description")}</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("settings.models.key")}</TableHead><TableHead>{t("settings.models.textEndpoint")}</TableHead><TableHead>{t("settings.models.editEndpoint")}</TableHead><TableHead>{t("settings.models.verified")}</TableHead></TableRow></TableHeader>
            <TableBody>{s.models.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">{m.key}</TableCell>
                <TableCell className="font-mono text-xs">{m.text_endpoint}</TableCell>
                <TableCell className="font-mono text-xs">{m.edit_endpoint}</TableCell>
                <TableCell>{m.verified ? <Badge variant="success">{m.verified}</Badge> : <Badge variant="warning">{t("settings.no")}</Badge>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.prices.title")}</CardTitle>
          <CardAction><Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending || !s.has_fal_key}><SearchCheckIcon /> {check.isPending ? t("settings.prices.checking") : t("settings.prices.check")}</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ErrorBox error={check.error} />
          <Table>
            <TableHeader><TableRow><TableHead>{t("settings.prices.endpoint")}</TableHead><TableHead className="num">{t("settings.prices.ours")}</TableHead><TableHead>{t("settings.prices.unit")}</TableHead><TableHead>{t("settings.prices.verified")}</TableHead>{check.data && <TableHead className="num">{t("settings.prices.falNow")}</TableHead>}</TableRow></TableHeader>
            <TableBody>{Object.entries(s.prices).map(([ep, p]) => {
              const live = check.data?.rows.find((r) => r.endpoint === ep);
              return (
                <TableRow key={ep}>
                  <TableCell className="font-mono text-xs">{ep}</TableCell><TableCell className="num">${p.unit_price}</TableCell><TableCell>{p.unit}</TableCell>
                  <TableCell>{p.verified ?? <Badge variant="warning">{t("settings.no")}</Badge>}</TableCell>
                  {check.data && <TableCell className="num">{live ? (live.fal == null ? <Badge variant="warning">{t("settings.prices.notFound")}</Badge> : <Badge variant={live.match ? "success" : "destructive"}>${live.fal}</Badge>) : "—"}</TableCell>}
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
