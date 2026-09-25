import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioLinesIcon, CheckCheckIcon, CheckIcon, MicIcon, RulerIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { api, fileUrl, RunRequest, VoiceLine, VoiceResp } from "../../api";
import { Empty, ErrorBox, Loading } from "../../components/common";
import { JobProgress } from "../../components/JobProgress";
import { ModelSelect } from "../../components/ModelSelect";
import { SpendModal } from "../../components/SpendModal";
import { useScopeJob } from "../../jobs";

function LineRow({ id, line, model, onGenerate }: { id: string; line: VoiceLine; model: string; onGenerate: (r: RunRequest) => void }) {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (file: string) => api.post(`/api/projects/${id}/voice/${line.id}/approve/v${file.match(/_v(\d+)\./)?.[1]}`),
    onSuccess: (_, file) => { toast.success(`${line.id}: approved ${file}`); qc.invalidateQueries({ queryKey: ["voice", id] }); },
  });
  return (
    <Card size="sm">
      <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{line.id}</span>
            <Badge variant="secondary">{line.speaker}</Badge>
            {line.emotion && <span className="text-xs text-muted-foreground">{line.emotion}</span>}
            {line.approved ? <Badge variant="success">approved</Badge> : line.takes.length ? <Badge variant="warning">pick a take</Badge> : null}
          </div>
          <div className="text-[15px]">{line.text}</div>
          {line.voice ? (
            <div className="text-xs text-muted-foreground">{line.voice.voice_id} · speed {line.voice.speed}{line.voice.emotion ? ` · ${line.voice.emotion}` : ""}</div>
          ) : (
            <div className="text-xs text-destructive">{line.voice_error} <Link to="/characters" className="underline">Characters</Link></div>
          )}
          <div>
            <Button variant="outline" size="sm" disabled={!line.voice} onClick={() => onGenerate({ kind: "voice", project: id, line_ids: [line.id], model: model || undefined })}>
              <SparklesIcon /> {line.takes.length ? "New take" : "Generate"}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {line.takes.length === 0 && <div className="text-sm text-muted-foreground">No takes yet.</div>}
          {[...line.takes].reverse().map((t) => (
            <div key={t.file} className={cn("flex items-center gap-2 rounded-lg border p-1.5", line.approved === t.file && "border-success")}>
              <audio controls preload="none" src={fileUrl("projects", id, "audio", t.file)} className="h-8 min-w-0 flex-1" />
              <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">{t.file.replace(`${line.id}_`, "").replace(/\.\w+$/, "")} · {t.duration?.toFixed(1) ?? "?"}s</span>
              <Button size="sm" variant={line.approved === t.file ? "secondary" : "outline"} disabled={approve.isPending} onClick={() => approve.mutate(t.file)}>
                <CheckIcon /> {line.approved === t.file ? "Approved" : "Approve"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function VoiceTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["voice", id], queryFn: () => api.get<VoiceResp>(`/api/projects/${id}/voice`) });
  const [model, setModel] = useState("");
  const [pending, setPending] = useState<RunRequest | null>(null);
  const [retimeIssues, setRetimeIssues] = useState<string[] | null>(null);
  const { jobId, setJob } = useScopeJob(`voice:${id}`, (j) => j.kind === "voice" && id.endsWith(`-${j.project}`));
  const refresh = () => ["voice", "project", "timing", "shots", "keyframes", "clips"].forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));
  const approveAll = useMutation({
    mutationFn: () => api.post(`/api/projects/${id}/voice/approve-latest`),
    onSuccess: () => { toast.success("Approved the newest take of every unapproved line"); refresh(); },
  });
  const track = useMutation({
    mutationFn: () => api.post<{ track: string; timing: { total_seconds: number } }>(`/api/projects/${id}/voice/track`),
    onSuccess: (r) => { toast.success(`Voice track ${r.track}: ${r.timing.total_seconds.toFixed(1)}s`); refresh(); },
  });
  const retime = useMutation({
    mutationFn: () => api.post<{ issues: string[] }>(`/api/projects/${id}/retime`),
    onSuccess: (r) => { setRetimeIssues(r.issues); toast.success("Shots moved onto the real timing"); refresh(); },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  if (!d.lines) return <Empty title="No script.json yet">Voice is generated line by line from the agreed script.</Empty>;
  const approved = d.lines.filter((l) => l.approved).length;
  const missingVoice = d.lines.some((l) => !l.voice);
  const total = d.timing?.source === "tts" ? d.timing.total_seconds : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Voice — {approved}/{d.lines.length} lines approved</CardTitle>
          <CardDescription>
            One take per line (≈ $0.0001 per character). Approve the best take, then build the voice track: it gives the video its real timing.
          </CardDescription>
          <CardAction className="flex flex-wrap items-end gap-2">
            <ModelSelect kind="tts" label="Voice model" value={model} onChange={setModel} />
            <Button disabled={missingVoice || !!jobId} onClick={() => setPending({ kind: "voice", project: id, model: model || undefined })}>
              <MicIcon /> Generate all lines
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {missingVoice && <Alert variant="warning"><AlertDescription>Some speakers have no voice yet — pick one on the <Link to="/characters" className="underline">Characters</Link> page (narrator voice: library/voices.yaml).</AlertDescription></Alert>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={approveAll.isPending} onClick={() => approveAll.mutate()}><CheckCheckIcon /> Approve newest takes</Button>
            <Button disabled={approved < d.lines.length || track.isPending} onClick={() => track.mutate()}>
              <AudioLinesIcon /> {track.isPending ? "Building…" : "Build voice track + timing"}
            </Button>
            <Button variant="outline" disabled={!d.track || retime.isPending} onClick={() => retime.mutate()}><RulerIcon /> Retime shots</Button>
          </div>
          <ErrorBox error={approveAll.error || track.error || retime.error} />
          {d.track && total !== null && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>Voice track <span className="font-mono text-xs">{d.track}</span> · {total.toFixed(1)}s (target {d.target_seconds}s)</span>
                <Badge variant={total > d.target_seconds * 1.1 ? "destructive" : "success"}>{total > d.target_seconds * 1.1 ? "over target" : "within target"}</Badge>
              </div>
              <Progress value={Math.min(100, (100 * total) / d.target_seconds)} />
              <audio controls preload="none" src={fileUrl("projects", id, "audio", d.track)} className="w-full" />
            </div>
          )}
          {retimeIssues && (retimeIssues.length === 0
            ? <Alert variant="success"><AlertDescription>All shots are 3–8 s on the real timing.</AlertDescription></Alert>
            : <Alert variant="warning"><AlertDescription>{retimeIssues.join(" · ")} — adjust in the Shots tab (or ask Claude to split/merge shots).</AlertDescription></Alert>)}
        </CardContent>
      </Card>
      {jobId && <JobProgress jobId={jobId} invalidate={[["voice", id], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {d.lines.map((l) => <LineRow key={l.id} id={id} line={l} model={model} onGenerate={setPending} />)}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
