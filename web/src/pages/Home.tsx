import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlusIcon, PlusIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, Overview } from "../api";
import { Empty, ErrorBox, Loading, PageHeader, Stepper } from "../components/common";
import { STAGE_ORDER, useMoney } from "../format";

function NewProject() {
  const { t } = useTranslation();
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState<"mandarin" | "cantonese">("mandarin");
  const [seconds, setSeconds] = useState(60);
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.post<{ id: string }>("/api/projects", { slug, language, seconds }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("home.new.created", { id: r.id }));
      nav(`/p/${r.id}/brief`);
    },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("home.new.title")}</CardTitle>
        <CardDescription>{t("home.new.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">{t("home.new.slug")}</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9][a-z0-9_\-]*" className="w-48"
              placeholder="demo-b" // i18n-ignore: example slug (data)
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("home.new.language")}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "mandarin" | "cantonese")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mandarin">{t("home.languages.mandarin")}</SelectItem>
                <SelectItem value="cantonese">{t("home.languages.cantonese")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="secs">{t("home.new.seconds")}</Label>
            <Input id="secs" type="number" min={15} max={180} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-24" />
          </div>
          <Button type="submit" disabled={!slug || m.isPending}><PlusIcon /> {t("home.new.create")}</Button>
        </form>
        <div className="mt-3"><ErrorBox error={m.error} /></div>
      </CardContent>
    </Card>
  );
}

export function Home() {
  const { t } = useTranslation();
  const money = useMoney();
  const q = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/overview") });
  const o = q.data;
  const pct = o && o.monthly_budget ? (100 * o.month_spend) / o.monthly_budget : 0;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("home.title")} description={t("home.description")}>
        {o && (
          <Card size="sm" className="min-w-60">
            <CardContent className="flex flex-col gap-1.5">
              <div className="text-xs text-muted-foreground">{t("home.spendThisMonth")}</div>
              <div className="flex items-baseline justify-between"><span className="font-semibold tabular-nums">{money(o.month_spend)}</span><span className="text-xs text-muted-foreground">{t("home.ofBudget", { amount: money(o.monthly_budget) })}</span></div>
              <Progress value={Math.min(100, pct)} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-spend" />
            </CardContent>
          </Card>
        )}
      </PageHeader>
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {o && !o.has_fal_key && (
        <Alert variant="warning"><AlertDescription>{t("home.falMissing")}</AlertDescription></Alert>
      )}
      {o && o.projects.length === 0 && <Empty title={t("home.empty.title")} icon={FolderPlusIcon}>{t("home.empty.body")}</Empty>}
      {o && o.projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {o.projects.map((p) => {
            const nextStage = STAGE_ORDER.find((s) => (p.stages[s] ?? "todo") === "todo");
            return (
              <Link key={p.id} to={`/p/${p.id}`} className="group">
                <Card className="h-full transition group-hover:ring-primary-mark/40">
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary-ink">{p.slug}</CardTitle>
                    <CardDescription>{p.id.slice(0, 10)}</CardDescription>
                    <Badge variant="secondary" className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                      {t(p.language === "mandarin" ? "home.languages.mandarin" : "home.languages.cantonese")} · {t("common.seconds", { n: p.target_seconds })}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Stepper stages={p.stages} />
                    <div className="text-xs text-muted-foreground">
                      {t("home.next", { stage: nextStage ? t(`common.stages.${nextStage}`) : t("home.clientReview") })} · {t("home.drafts", { count: p.drafts })}
                      {p.shots ? ` · ${t("home.keyframesApproved", { approved: p.approved_keyframes, total: p.shots })}` : ""}
                    </div>
                  </CardContent>
                  <CardFooter className="justify-end text-xs text-muted-foreground">{t("home.spent", { amount: money(p.spend) })}</CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <NewProject />
    </div>
  );
}
