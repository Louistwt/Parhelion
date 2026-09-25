import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, FilmIcon, FolderIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fileUrl, Render } from "../../api";
import { CopyButton, Empty, ErrorBox, Loading } from "../../components/common";
import { useSettings } from "../../format";

export function VideoTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const q = useQuery({ queryKey: ["renders", id], queryFn: () => api.get<{ renders: Render[]; folder: string }>(`/api/projects/${id}/renders`) });
  const [sel, setSel] = useState<number | null>(null);
  const render = useMutation({
    mutationFn: () => api.post<Render>(`/api/projects/${id}/renders`),
    onSuccess: (r) => {
      toast.success(`Rendered ${r.rough_cut} (${r.duration.toFixed(1)}s)`);
      setSel(r.version);
      qc.invalidateQueries({ queryKey: ["renders", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const sys = settings.data?.system;
  const list = q.data?.renders ?? [];
  const cur = list.find((r) => r.version === sel) ?? list[0];
  const stills = cur ? cur.shots.filter((s) => s.source !== "clip").length : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Rough cut</CardTitle>
          <CardDescription>
            Free (FFmpeg on this laptop). Uses approved clips; shots without a clip use their keyframe with a slow zoom, so you can
            render an animatic as soon as the voice track exists. Output: MP4 with subtitles, a clean MP4, an SRT and a CapCut folder.
          </CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            {list.length > 0 && cur && (
              <Select value={String(cur.version)} onValueChange={(v) => setSel(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{list.map((r) => <SelectItem key={r.version} value={String(r.version)}>{r.rough_cut}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button disabled={render.isPending || !sys?.ffmpeg || !sys?.font} onClick={() => render.mutate()}>
              <FilmIcon /> {render.isPending ? "Rendering… (~1 min)" : "Render new version"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sys && !sys.ffmpeg && <Alert variant="destructive"><AlertDescription>ffmpeg not found. Run <code>sudo apt install ffmpeg</code> (or reinstall with <code>uv sync</code>).</AlertDescription></Alert>}
          {sys && !sys.font && <Alert variant="destructive"><AlertDescription>No Chinese font for subtitles. Run <code>sudo apt install fonts-noto-cjk</code>.</AlertDescription></Alert>}
          {sys?.ffmpeg && <div className="text-xs text-muted-foreground">ffmpeg: {sys.ffmpeg_source} · subtitle font: {sys.font?.split("/").pop()}</div>}
          <ErrorBox error={render.error} />
        </CardContent>
      </Card>
      {q.isLoading && <Loading />}
      {!q.isLoading && !cur && <Empty title="No rough cut yet">Needs script.json, a shot list and timing (ideally the voice track).</Empty>}
      {cur && (
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
          <Card size="sm" className="self-start">
            <CardContent className="flex flex-col gap-2">
              <video key={cur.rough_cut} controls preload="metadata" src={fileUrl("projects", id, "output", cur.rough_cut)} className="aspect-[9/16] w-full rounded-lg bg-black" />
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{cur.duration.toFixed(1)}s</Badge>
                {cur.voice ? <Badge variant="success">voice: {cur.voice}</Badge> : <Badge variant="warning">no voice (silent)</Badge>}
                {stills > 0 && <Badge variant="warning">{stills} still shot(s)</Badge>}
              </div>
            </CardContent>
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Files for CapCut</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {[cur.rough_cut, cur.clean, cur.srt].map((f) => (
                    <Button key={f} variant="outline" size="sm" asChild>
                      <a href={fileUrl("projects", id, "output", f)} download><DownloadIcon /> {f}</a>
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <FolderIcon className="size-4 text-muted-foreground" />
                  <code className="min-w-0 flex-1 truncate text-xs">{q.data?.folder}/{cur.capcut}</code>
                  <CopyButton text={`${q.data?.folder}/${cur.capcut}`} label="Copy path" />
                </div>
                <p className="text-xs text-muted-foreground">
                  The folder has every shot cut to length (clips/S01.mp4…), the voice track and per-line audio, subtitles.srt and a README with the
                  import order. From Windows: open <code>\\wsl$</code> in Explorer and paste the path.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Shots in this cut</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Shot</TableHead><TableHead className="num">Start</TableHead><TableHead className="num">End</TableHead><TableHead>Source</TableHead><TableHead>Lines</TableHead></TableRow></TableHeader>
                  <TableBody>{cur.shots.map((s) => (
                    <TableRow key={s.shot}>
                      <TableCell className="font-mono text-xs">{s.shot}</TableCell>
                      <TableCell className="num">{s.start.toFixed(2)}</TableCell>
                      <TableCell className="num">{s.end.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={s.source === "clip" ? "success" : s.source.startsWith("still") ? "warning" : "destructive"}>{s.source}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.lines.join(", ")}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
