import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ClapperboardIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
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
  const approved = shot.approved === file;
  return (
    <div className={cn("flex w-40 flex-col gap-1.5 rounded-lg border p-1.5", approved && "border-success")}>
      <video controls preload="metadata" src={fileUrl("projects", id, "clips", file)} className="aspect-[9/16] w-full rounded bg-black object-cover" />
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-muted-foreground">{file.replace(`${shot.id}_`, "").replace(/\.\w+$/, "")}</span>
        <Button size="xs" variant={approved ? "secondary" : "outline"} disabled={busy} onClick={() => onApprove(file)}>
          <CheckIcon /> {approved ? "Approved" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function ShotRow({ id, shot, n, model, lipModel, hasTrack, onGenerate }: {
  id: string; shot: ClipShot; n: number; model: string; lipModel: string; hasTrack: boolean; onGenerate: (r: RunRequest) => void;
}) {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (file: string) => api.post(`/api/projects/${id}/clips/${shot.id}/approve`, { text: file }),
    onSuccess: (_, f) => { toast.success(`${shot.id}: approved ${f}`); qc.invalidateQueries({ queryKey: ["clips", id] }); qc.invalidateQueries({ queryKey: ["project", id] }); },
  });
  return (
    <Card>
      <CardContent className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{shot.id}</span>
            <span className="text-xs text-muted-foreground">{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s · {shot.duration.toFixed(1)}s</span>
            {shot.approved ? <Badge variant="success">clip approved</Badge> : null}
            {shot.on_camera_speech && <Badge variant="secondary"><MessageCircleIcon /> speaks</Badge>}
          </div>
          {shot.keyframe
            ? <img src={fileUrl("projects", id, "keyframes", shot.keyframe)} alt={shot.keyframe} className="aspect-[9/16] w-32 rounded-lg object-cover" />
            : <div className="flex aspect-[9/16] w-32 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">approve a keyframe first</div>}
          <div className="text-sm">{shot.text}</div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Motion prompt (edit in Shots tab)</summary>
            <div className="prompt-block mt-1">{shot.prompt}</div>
          </details>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" disabled={!shot.keyframe} onClick={() => onGenerate({ kind: "clips", project: id, shot_ids: [shot.id], n, model: model || undefined })}>
              <SparklesIcon /> {shot.clips.length ? "New take" : "Animate"}
            </Button>
            {shot.on_camera_speech && (
              <Button variant="outline" size="sm" disabled={!shot.approved || !hasTrack} title={!hasTrack ? "Build the voice track first" : undefined}
                onClick={() => onGenerate({ kind: "lipsync", project: id, shot_ids: [shot.id], model: lipModel || undefined })}>
                <MessageCircleIcon /> Lip-sync
              </Button>
            )}
          </div>
          <ErrorBox error={approve.error} />
        </div>
        <div className="flex flex-wrap content-start gap-3">
          {shot.clips.length === 0 && shot.lipsync.length === 0 && <div className="text-sm text-muted-foreground">No clips yet.</div>}
          {[...shot.lipsync].reverse().map((f) => <Take key={f} id={id} shot={shot} file={f} busy={approve.isPending} onApprove={(x) => approve.mutate(x)} />)}
          {[...shot.clips].reverse().map((f) => <Take key={f} id={id} shot={shot} file={f} busy={approve.isPending} onApprove={(x) => approve.mutate(x)} />)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ClipsTab({ id }: { id: string }) {
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
  if (!shots) return <Empty title="No shot list yet">Build the shot list and approve keyframes first.</Empty>;
  const ready = shots.filter((s) => s.keyframe && !s.approved).length;
  const speaking = shots.filter((s) => s.on_camera_speech && s.approved).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Clips — {shots.filter((s) => s.approved).length}/{shots.length} approved</CardTitle>
          <CardDescription>
            The expensive stage: each approved keyframe becomes a short clip (5–10 s, trimmed to the shot in the rough cut).
            Agree the storyboard first. One take per shot; regenerate only the ones you reject.
          </CardDescription>
          <CardAction className="flex flex-wrap items-end gap-2">
            <ModelSelect kind="video" label="Video model" value={model} onChange={setModel} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="takes" className="text-xs text-muted-foreground">Takes</Label>
              <Input id="takes" type="number" min={1} max={3} value={takes} onChange={(e) => setN(Number(e.target.value))} className="w-16" />
            </div>
            <Button disabled={!ready || !!jobId} onClick={() => setPending({ kind: "clips", project: id, n: takes, model: model || undefined })}>
              <ClapperboardIcon /> Animate all ready ({ready})
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <ModelSelect kind="lipsync" id="lipmodel" label="Lip-sync model" value={lipModel} onChange={setLipModel} />
          <Button variant="outline" disabled={!speaking || !q.data?.has_track || !!jobId}
            onClick={() => setPending({ kind: "lipsync", project: id, model: lipModel || undefined })}>
            <MessageCircleIcon /> Lip-sync speaking shots ({speaking})
          </Button>
          {!q.data?.has_track && <Alert variant="warning" className="w-auto"><AlertDescription>Lip-sync needs the voice track (Voice tab).</AlertDescription></Alert>}
        </CardContent>
      </Card>
      {jobId && <JobProgress jobId={jobId} invalidate={[["clips", id], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {shots.map((s) => <ShotRow key={s.id} id={id} shot={s} n={takes} model={model} lipModel={lipModel} hasTrack={!!q.data?.has_track} onGenerate={setPending} />)}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
