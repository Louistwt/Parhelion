import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";
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

type KfResp = { shots: KeyframeShot[] | null; folder: string };

function ShotRow({ id, shot, n, model, onGenerate }: {
  id: string; shot: KeyframeShot; n: number; model: string; onGenerate: (req: RunRequest) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<number | null>(null);
  const approve = useMutation({
    mutationFn: (name: string) => {
      const v = name.match(/_v(\d+)\./)?.[1];
      return api.post(`/api/projects/${id}/keyframes/${shot.id}/approve/v${v}`);
    },
    onSuccess: (_, name) => {
      toast.success(`${shot.id}: approved ${name}`);
      qc.invalidateQueries({ queryKey: ["keyframes", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const discard = useMutation({
    mutationFn: (name: string) => api.post(`/api/projects/${id}/keyframes/${shot.id}/discard/v${name.match(/_v(\d+)\./)?.[1]}`),
    onSuccess: (_, name) => { toast.success(`${name} discarded`); qc.invalidateQueries({ queryKey: ["keyframes", id] }); },
    onError: (e) => toast.error(String(e)),
  });
  const images = shot.variants.map((v) => ({ name: v, src: fileUrl("projects", id, "keyframes", v) }));
  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{shot.id}</span>
            <span className="text-xs text-muted-foreground">{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s</span>
            {shot.approved ? <Badge variant="success">approved</Badge> : <Badge variant="secondary">pick one</Badge>}
          </div>
          <div className="text-[15px]">{shot.text || <span className="text-muted-foreground">(no line)</span>}</div>
          <div className="text-xs text-muted-foreground">{shot.framing}{shot.characters.length ? ` · ${shot.characters.join(", ")}` : ""}</div>
          <div className="text-sm">{shot.action}</div>
          <div>
            <Button variant="outline" size="sm" onClick={() => onGenerate({ kind: "keyframes", project: id, shot_ids: [shot.id], n, model: model || undefined })}>
              <SparklesIcon /> Generate {n} {shot.variants.length ? "more" : "variants"}
            </Button>
          </div>
          <ErrorBox error={approve.error} />
        </div>
        <ThumbGrid>
          {images.map((im, i) => (
            <Thumb key={im.name} src={im.src} label={im.name.replace(`${shot.id}_`, "").replace(/\.\w+$/, "")} approved={shot.approved === im.name} onClick={() => setOpen(i)} />
          ))}
          {images.length === 0 && <ThumbEmpty label="no keyframes yet" />}
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
  if (!shots) return <Empty title="No shot list yet">Build the shot list first (Shots tab).</Empty>;
  const missing = shots.filter((s) => !s.approved).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-semibold">{shots.length - missing}/{shots.length} shots approved</div>
            <div className="text-sm text-muted-foreground">
              Click a thumbnail to compare, approve (<Kbd>Enter</Kbd>) or discard. Only approved keyframes go on the storyboard.
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <ModelSelect value={model} onChange={setModel} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variants" className="text-xs text-muted-foreground">Variants</Label>
              <Input id="variants" type="number" min={1} max={4} value={variants} onChange={(e) => setN(Number(e.target.value))} className="w-16" />
            </div>
            <Button disabled={!missing || !!jobId} onClick={() => setPending({ kind: "keyframes", project: id, n: variants, model: model || undefined })}>
              <SparklesIcon /> Generate all missing ({missing})
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
