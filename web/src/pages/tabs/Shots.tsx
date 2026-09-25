import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, Character, Shot } from "../../api";
import { CopyButton, Empty, ErrorBox, Loading } from "../../components/common";
import { LintPanel } from "../../components/LintPanel";

type ShotsResp = { shots: Shot[] | null; framings: string[] };

function ShotCard({ id, shot, framings, characters }: { id: string; shot: Shot; framings: string[]; characters: string[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    framing: shot.framing, setting: shot.setting, action: shot.action, notes: shot.notes,
    characters: shot.characters, props: shot.props.join(", "),
    motion_prompt: shot.motion_prompt, camera: shot.camera, on_camera_speech: shot.on_camera_speech,
  });
  const dirty =
    form.framing !== shot.framing || form.setting !== shot.setting || form.action !== shot.action ||
    form.notes !== shot.notes || form.characters.join() !== shot.characters.join() || form.props !== shot.props.join(", ") ||
    form.motion_prompt !== shot.motion_prompt || form.camera !== shot.camera || form.on_camera_speech !== shot.on_camera_speech;
  const save = useMutation({
    mutationFn: () => api.put(`/api/projects/${id}/shots/${shot.id}`, {
      ...form, props: form.props.split(",").map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success(`${shot.id} saved`);
      qc.invalidateQueries({ queryKey: ["shots", id] });
      qc.invalidateQueries({ queryKey: ["lint", id] });
    },
  });
  const toggleChar = (c: string, on: boolean) =>
    setForm((f) => ({ ...f, characters: on ? [...f.characters, c] : f.characters.filter((x) => x !== c) }));
  const fid = (k: string) => `${shot.id}-${k}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {shot.id}
          <span className="text-sm font-normal text-muted-foreground">{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s · {shot.duration.toFixed(1)}s</span>
          {shot.approved_keyframe && <Badge variant="success">keyframe approved</Badge>}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {dirty && <Badge variant="warning">unsaved</Badge>}
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> Save</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shot.lines.map((l) => (
          <div key={l.id}><div className="text-xs text-muted-foreground">{l.id} · {l.speaker}</div><div className="text-[15px]">{l.text}</div></div>
        ))}
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label>Framing</Label>
            <Select value={form.framing} onValueChange={(v) => setForm({ ...form, framing: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([...framings, form.framing])].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("setting")}>Setting</Label>
            <Input id={fid("setting")} value={form.setting} onChange={(e) => setForm({ ...form, setting: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("props")}>Props (comma separated)</Label>
            <Input id={fid("props")} value={form.props} onChange={(e) => setForm({ ...form, props: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fid("action")}>Action — what we see (no text in image)</Label>
          <Textarea id={fid("action")} rows={2} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">Characters:</span>
          {characters.map((c) => (
            <Label key={c} className="font-normal">
              <Checkbox checked={form.characters.includes(c)} onCheckedChange={(v) => toggleChar(c, v === true)} /> {c}
            </Label>
          ))}
          {characters.length === 0 && <span className="text-muted-foreground">none in library</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("motion")}>Motion — what moves in the clip (keep it simple)</Label>
            <Input id={fid("motion")} value={form.motion_prompt} placeholder="e.g. 张叔 blows on his tea, steam rises" onChange={(e) => setForm({ ...form, motion_prompt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("camera")}>Camera</Label>
            <Input id={fid("camera")} value={form.camera} placeholder="static camera" onChange={(e) => setForm({ ...form, camera: e.target.value })} />
          </div>
        </div>
        <Label className="font-normal">
          <Checkbox checked={form.on_camera_speech} onCheckedChange={(v) => setForm({ ...form, on_camera_speech: v === true })} />
          Character speaks on camera (gets lip-sync; costs extra)
        </Label>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fid("notes")}>Notes for the storyboard</Label>
          <Input id={fid("notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Composed image prompt</summary>
          <div className="prompt-block mt-1.5">{shot.prompt}</div>
        </details>
        <ErrorBox error={save.error} />
      </CardContent>
    </Card>
  );
}

export function ShotsTab({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["shots", id], queryFn: () => api.get<ShotsResp>(`/api/projects/${id}/shots`) });
  const chars = useQuery({ queryKey: ["characters"], queryFn: () => api.get<{ characters: Character[] }>("/api/characters") });
  const prompt =
    `Read CLAUDE.md, projects/${id}/script.json, projects/${id}/timing.json and library/prompt_templates.yaml. ` +
    `Write projects/${id}/shotlist.json: shots of 3–8 s that follow timing.json, each with line_ids, framing (from prompt_templates framings), ` +
    `characters (library names), props, setting and action only — no text in images. Then run \`uv run parhelion lint ${id}\`.`;
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data?.shots) {
    return (
      <div className="flex flex-col gap-4">
        <Empty title="No shot list yet">Estimate timing first, then ask Claude Code to build shotlist.json.</Empty>
        <Card>
          <CardHeader>
            <CardTitle>Prompt for Claude Code</CardTitle>
            <CardAction><CopyButton text={prompt} label="Copy prompt" /></CardAction>
          </CardHeader>
          <CardContent><div className="prompt-block">{prompt}</div></CardContent>
        </Card>
      </div>
    );
  }
  const names = chars.data?.characters.map((c) => c.name) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <CardDescription>{q.data.shots.length} shots. Edit the visual fields here; line text and timing come from the script.</CardDescription>
      {q.data.shots.map((s) => (
        <ShotCard key={`${s.id}-${s.framing}-${s.action}-${s.setting}-${s.notes}-${s.characters.join()}-${s.props.join()}-${s.motion_prompt}-${s.camera}-${s.on_camera_speech}-${s.start}-${s.end}`} id={id} shot={s} framings={q.data!.framings} characters={names} />
      ))}
      <LintPanel project={id} />
    </div>
  );
}
