import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideoIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, fileUrl, KeyframeShot, RunRequest } from "../../api";
import { Empty, ErrorBox, Kbd, Loading } from "../../components/common";
import { JobProgress } from "../../components/JobProgress";
import { Lightbox } from "../../components/Lightbox";
import { ModelSelect } from "../../components/ModelSelect";
import { SpendModal } from "../../components/SpendModal";
import { Thumb, ThumbEmpty, ThumbGrid } from "../../components/Thumb";
import { useSettings } from "../../format";
import { useScopeJob } from "../../jobs";
import enShots from "../../locales/en/shots";

type KfResp = { shots: KeyframeShot[] | null; folder: string };
type TFn = ReturnType<typeof useTranslation>["t"];
/** Framing keys come from library/prompt_templates.yaml; unknown keys are shown as-is. */
const framingLabel = (t: TFn, f: string) => (f in enShots.framings ? t(`shots.framings.${f as keyof typeof enShots.framings}`) : f);

function ShotRow({ id, shot, n, model, onGenerate }: {
  id: string; shot: KeyframeShot; n: number; model: string; onGenerate: (req: RunRequest) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState<number | null>(null);
  const approve = useMutation({
    mutationFn: (name: string) => {
      const v = name.match(/_v(\d+)\./)?.[1];
      return api.post(`/api/projects/${id}/keyframes/${shot.id}/approve/v${v}`);
    },
    onSuccess: (_, name) => {
      toast.success(t("keyframes.approvedToast", { id: shot.id, name }));
      qc.invalidateQueries({ queryKey: ["keyframes", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const discard = useMutation({
    mutationFn: (name: string) => api.post(`/api/projects/${id}/keyframes/${shot.id}/discard/v${name.match(/_v(\d+)\./)?.[1]}`),
    onSuccess: (_, name) => { toast.success(t("keyframes.discardedToast", { name })); qc.invalidateQueries({ queryKey: ["keyframes", id] }); },
    onError: (e) => toast.error(String(e)),
  });
  const images = shot.variants.map((v) => ({ name: v, src: fileUrl("projects", id, "keyframes", v) }));
  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{shot.id}</span>
            <span className="text-xs text-muted-foreground">{t("common.seconds", { n: `${shot.start.toFixed(1)}–${shot.end.toFixed(1)}` })}</span>
            {shot.approved ? <Badge variant="success">{t("common.actions.approved")}</Badge> : <Badge variant="warning">{t("keyframes.pickOne")}</Badge>}
          </div>
          <div className="text-[15px]">{shot.text || <span className="text-muted-foreground">{t("keyframes.noLine")}</span>}</div>
          <div className="text-xs text-muted-foreground">{framingLabel(t, shot.framing)}{shot.characters.length ? ` · ${shot.characters.join(", ")}` : ""}</div>
          <div className="text-sm">{shot.action}</div>
          <div>
            <Button variant="spend" size="sm" onClick={() => onGenerate({ kind: "keyframes", project: id, shot_ids: [shot.id], n, model: model || undefined })}>
              <SparklesIcon /> {shot.variants.length ? t("keyframes.generateMore", { count: n }) : t("keyframes.generateVariants", { count: n })}
            </Button>
          </div>
          <ErrorBox error={approve.error} />
        </div>
        <ThumbGrid>
          {images.map((im, i) => (
            <Thumb key={im.name} src={im.src} label={im.name.replace(`${shot.id}_`, "").replace(/\.\w+$/, "")} approved={shot.approved === im.name} onClick={() => setOpen(i)} />
          ))}
          {images.length === 0 && <ThumbEmpty label={t("keyframes.noKeyframes")} />}
        </ThumbGrid>
      </CardContent>
      {open !== null && (
        <Lightbox
          title={`${shot.id} — ${shot.text}`}
          images={images}
          approved={shot.approved ? [shot.approved] : []}
          start={open}
          onApprove={(name) => approve.mutate(name)}
          onDiscard={(name) => discard.mutate(name)}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}

export function KeyframesTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const q = useQuery({ queryKey: ["keyframes", id], queryFn: () => api.get<KfResp>(`/api/projects/${id}/keyframes`) });
  const [model, setModel] = useState("");
  const [n, setN] = useState<number | null>(null);
  const [pending, setPending] = useState<RunRequest | null>(null);
  const { jobId, setJob } = useScopeJob(`kf:${id}`, (j) => j.kind === "keyframes" && id.endsWith(`-${j.project}`));
  const variants = n ?? settings.data?.pipeline.keyframes.variants_per_shot ?? 1;

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const shots = q.data?.shots;
  if (!shots) return <Empty title={t("keyframes.empty.title")} icon={ListVideoIcon}>{t("keyframes.empty.body")}</Empty>;
  const missing = shots.filter((s) => !s.approved).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-semibold">{t("keyframes.approvedCount", { done: shots.length - missing, total: shots.length })}</div>
            <div className="text-sm text-muted-foreground">
              <Trans i18nKey="keyframes.help" components={{ kbd: <Kbd>{null}</Kbd> }} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <ModelSelect value={model} onChange={setModel} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variants" className="text-xs text-muted-foreground">{t("keyframes.variants")}</Label>
              <Input id="variants" type="number" min={1} max={4} value={variants} onChange={(e) => setN(Number(e.target.value))} className="w-16" />
            </div>
            <Button variant="spend" disabled={!missing || !!jobId} onClick={() => setPending({ kind: "keyframes", project: id, n: variants, model: model || undefined })}>
              <SparklesIcon /> {t("keyframes.generateAll", { count: missing })}
            </Button>
          </div>
        </CardContent>
      </Card>
      {jobId && <JobProgress jobId={jobId} invalidate={[["keyframes", id], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {shots.map((s) => <ShotRow key={s.id} id={id} shot={s} n={variants} model={model} onGenerate={setPending} />)}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
