import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ClapperboardIcon, ListVideoIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api, ClipShot, fileUrl, RunRequest } from "../../api";
import { Empty, ErrorBox, Loading } from "../../components/common";
import { JobProgress } from "../../components/JobProgress";
import { ModelSelect } from "../../components/ModelSelect";
import { SpendModal } from "../../components/SpendModal";
import { useSettings } from "../../format";
import { useScopeJob } from "../../jobs";

type ClipsResp = { shots: ClipShot[] | null; has_track: boolean };

function Take({ id, shot, file, onApprove, busy }: { id: string; shot: ClipShot; file: string; onApprove: (f: string) => void; busy: boolean }) {
  const { t } = useTranslation();
  const approved = shot.approved === file;
  return (
    <div className={cn("flex w-40 flex-col gap-1.5 rounded-lg border p-1.5", approved && "border-success")}>
      <video controls preload="metadata" src={fileUrl("projects", id, "clips", file)} className="aspect-[9/16] w-full rounded bg-black object-cover" />
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-muted-foreground">{file.replace(`${shot.id}_`, "").replace(/\.\w+$/, "")}</span>
        <Button size="xs" variant={approved ? "secondary" : "outline"} disabled={busy} onClick={() => onApprove(file)}>
          <CheckIcon /> {approved ? t("common.actions.approved") : t("common.actions.approve")}
        </Button>
      </div>
    </div>
  );
}

function ShotRow({ id, shot, n, model, lipModel, hasTrack, onGenerate }: {
  id: string; shot: ClipShot; n: number; model: string; lipModel: string; hasTrack: boolean; onGenerate: (r: RunRequest) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (file: string) => api.post(`/api/projects/${id}/clips/${shot.id}/approve`, { text: file }),
    onSuccess: (_, f) => { toast.success(t("clips.approvedToast", { id: shot.id, name: f })); qc.invalidateQueries({ queryKey: ["clips", id] }); qc.invalidateQueries({ queryKey: ["project", id] }); },
  });
  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{shot.id}</span>
            <span className="text-xs text-muted-foreground">{t("common.seconds", { n: `${shot.start.toFixed(1)}–${shot.end.toFixed(1)}` })} · {t("common.seconds", { n: shot.duration.toFixed(1) })}</span>
            {shot.approved ? <Badge variant="success">{t("clips.clipApproved")}</Badge> : null}
            {shot.on_camera_speech && <Badge variant="secondary"><MessageCircleIcon /> {t("clips.speaks")}</Badge>}
          </div>
          {shot.keyframe
            ? <img src={fileUrl("projects", id, "keyframes", shot.keyframe)} alt={shot.keyframe} className="aspect-[9/16] w-32 rounded-lg object-cover" />
            : <div className="flex aspect-[9/16] w-32 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">{t("clips.approveKeyframeFirst")}</div>}
          <div className="text-sm">{shot.text}</div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">{t("clips.motionPrompt")}</summary>
            <div className="prompt-block mt-1">{shot.prompt}</div>
          </details>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="spend" size="sm" disabled={!shot.keyframe} onClick={() => onGenerate({ kind: "clips", project: id, shot_ids: [shot.id], n, model: model || undefined })}>
              <SparklesIcon /> {shot.clips.length ? t("clips.newTake") : t("clips.animate")}
            </Button>
            {shot.on_camera_speech && (
              <Button variant="spend" size="sm" disabled={!shot.approved || !hasTrack} title={!hasTrack ? t("clips.needTrack") : undefined}
                onClick={() => onGenerate({ kind: "lipsync", project: id, shot_ids: [shot.id], model: lipModel || undefined })}>
                <MessageCircleIcon /> {t("clips.lipsync")}
              </Button>
            )}
          </div>
          <ErrorBox error={approve.error} />
        </div>
        <div className="flex flex-wrap content-start gap-3">
          {shot.clips.length === 0 && shot.lipsync.length === 0 && <div className="text-sm text-muted-foreground">{t("clips.noClips")}</div>}
          {[...shot.lipsync].reverse().map((f) => <Take key={f} id={id} shot={shot} file={f} busy={approve.isPending} onApprove={(x) => approve.mutate(x)} />)}
          {[...shot.clips].reverse().map((f) => <Take key={f} id={id} shot={shot} file={f} busy={approve.isPending} onApprove={(x) => approve.mutate(x)} />)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClipsTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const q = useQuery({ queryKey: ["clips", id], queryFn: () => api.get<ClipsResp>(`/api/projects/${id}/clips`) });
  const [model, setModel] = useState("");
  const [lipModel, setLipModel] = useState("");
  const [n, setN] = useState<number | null>(null);
  const [pending, setPending] = useState<RunRequest | null>(null);
  const { jobId, setJob } = useScopeJob(`clips:${id}`, (j) => (j.kind === "clips" || j.kind === "lipsync") && id.endsWith(`-${j.project}`));
  const takes = n ?? settings.data?.pipeline.clips?.variants_per_shot ?? 1;

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const shots = q.data?.shots;
  if (!shots) return <Empty title={t("clips.empty.title")} icon={ListVideoIcon}>{t("clips.empty.body")}</Empty>;
  const ready = shots.filter((s) => s.keyframe && !s.approved).length;
  const speaking = shots.filter((s) => s.on_camera_speech && s.approved).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("clips.title", { done: shots.filter((s) => s.approved).length, total: shots.length })}</CardTitle>
          <CardDescription>{t("clips.description")}</CardDescription>
          <CardAction className="flex flex-wrap items-end gap-2">
            <ModelSelect kind="video" label={t("clips.videoModel")} value={model} onChange={setModel} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="takes" className="text-xs text-muted-foreground">{t("clips.takes")}</Label>
              <Input id="takes" type="number" min={1} max={3} value={takes} onChange={(e) => setN(Number(e.target.value))} className="w-16" />
            </div>
            <Button variant="spend" disabled={!ready || !!jobId} onClick={() => setPending({ kind: "clips", project: id, n: takes, model: model || undefined })}>
              <ClapperboardIcon /> {t("clips.animateAll", { count: ready })}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <ModelSelect kind="lipsync" id="lipmodel" label={t("clips.lipsyncModel")} value={lipModel} onChange={setLipModel} />
          <Button variant="spend" disabled={!speaking || !q.data?.has_track || !!jobId}
            onClick={() => setPending({ kind: "lipsync", project: id, model: lipModel || undefined })}>
            <MessageCircleIcon /> {t("clips.lipsyncAll", { count: speaking })}
          </Button>
          {!q.data?.has_track && <Alert variant="warning" className="w-auto"><AlertDescription>{t("clips.needTrackAlert")}</AlertDescription></Alert>}
        </CardContent>
      </Card>
      {jobId && <JobProgress jobId={jobId} invalidate={[["clips", id], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {shots.map((s) => <ShotRow key={s.id} id={id} shot={s} n={takes} model={model} lipModel={lipModel} hasTrack={!!q.data?.has_track} onGenerate={setPending} />)}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
