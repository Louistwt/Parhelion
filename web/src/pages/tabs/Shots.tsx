import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, ImageIcon, RotateCcwIcon, SaveIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { api, CharacterList, fileUrl, Shot } from "../../api";
import { CopyButton, Empty, ErrorBox, Loading } from "../../components/common";
import { LintPanel } from "../../components/LintPanel";

type ShotsResp = { shots: Shot[] | null; framings: string[] };
type Form = {
  framing: string; setting: string; action: string; notes: string; characters: string[]; props: string[];
  motion_prompt: string; camera: string; on_camera_speech: boolean;
};
type Who = { name: string; label: string };

const CAMERAS = ["static camera", "slow push in", "slow pull out", "slow pan left", "slow pan right", "subtle handheld"];
const MIN_S = 3, MAX_S = 8;

const toForm = (s: Shot): Form => ({
  framing: s.framing, setting: s.setting, action: s.action, notes: s.notes, characters: s.characters, props: s.props,
  motion_prompt: s.motion_prompt, camera: s.camera, on_camera_speech: s.on_camera_speech,
});
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}{hint && <span className="font-normal text-muted-foreground"> — {hint}</span>}</Label>
      {children}
    </div>
  );
}

function PropsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
      {value.map((p) => (
        <Badge key={p} variant="secondary" className="gap-1 pr-1">
          {p}
          <button type="button" aria-label={`Remove ${p}`} className="rounded-sm opacity-60 hover:opacity-100" onClick={() => onChange(value.filter((x) => x !== p))}>
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id} value={text} placeholder={value.length ? "add…" : "e.g. two car keys (Enter to add)"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-3 py-2 text-sm font-medium">
        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" /> {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 border-t px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ShotHeader({ id, shot, form, dirty, who }: { id: string; shot: Shot; form: Form; dirty: boolean; who: Who[] }) {
  const ok = shot.duration >= MIN_S && shot.duration <= MAX_S;
  const text = shot.lines.map((l) => l.text).join(" ");
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="aspect-[9/16] w-9 shrink-0 overflow-hidden rounded bg-muted">
        {shot.approved_keyframe
          ? <img src={fileUrl("projects", id, "keyframes", shot.approved_keyframe)} alt="" className="size-full object-cover" />
          : <ImageIcon className="m-auto mt-3 size-3.5 text-muted-foreground" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{shot.id}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s</span>
          <span className="flex items-center gap-1.5 text-xs tabular-nums" title={`Shots must be ${MIN_S}–${MAX_S}s`}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", ok ? "bg-primary" : "bg-destructive")} style={{ width: `${Math.min(100, (shot.duration / MAX_S) * 100)}%` }} />
            </span>
            <span className={ok ? "text-muted-foreground" : "text-destructive"}>{shot.duration.toFixed(1)}s</span>
          </span>
          <Badge variant="outline">{form.framing}</Badge>
          {form.characters.map((c) => <Badge key={c} variant="secondary">{who.find((w) => w.name === c)?.label ?? c}</Badge>)}
          {dirty && <Badge variant="warning">unsaved</Badge>}
        </div>
        <div className="truncate text-sm font-normal text-muted-foreground">{text || "(no line)"}</div>
      </div>
    </div>
  );
}

function ShotEditor({ shot, form, setForm, framings, who, dirty, onSave, saving, onReset }: {
  shot: Shot; form: Form; setForm: (f: Form) => void; framings: string[]; who: Who[];
  dirty: boolean; onSave: () => void; saving: boolean; onReset: () => void;
}) {
  const fid = (k: string) => `${shot.id}-${k}`;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const cameras = [...new Set([...CAMERAS, ...(form.camera ? [form.camera] : [])])];
  return (
    <div className="flex flex-col gap-4 pt-1">
      {shot.lines.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2">
          {shot.lines.map((l) => (
            <div key={l.id} className="text-[15px]"><span className="mr-2 text-xs text-muted-foreground">{l.id} · {who.find((w) => w.name === l.speaker)?.label ?? l.speaker}</span>{l.text}</div>
          ))}
        </div>
      )}
      <Field label="Action" hint="what the picture shows; no text in images" htmlFor={fid("action")}>
        <Textarea id={fid("action")} rows={3} value={form.action} onChange={(e) => set("action", e.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Field label="Framing" htmlFor={fid("framing")}>
          <Select value={form.framing} onValueChange={(v) => set("framing", v)}>
            <SelectTrigger id={fid("framing")} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([...framings, form.framing])].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Setting" htmlFor={fid("setting")}>
          <Textarea id={fid("setting")} rows={2} value={form.setting} onChange={(e) => set("setting", e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Field label="Who's in it">
          {who.length ? (
            <ToggleGroup type="multiple" variant="outline" size="sm" value={form.characters} onValueChange={(v) => set("characters", v)} className="flex-wrap">
              {who.map((w) => <ToggleGroupItem key={w.name} value={w.name} aria-label={w.label}>{w.label}</ToggleGroupItem>)}
            </ToggleGroup>
          ) : <span className="text-sm text-muted-foreground">No characters in the library</span>}
        </Field>
        <Field label="Props" htmlFor={fid("props")}>
          <PropsInput id={fid("props")} value={form.props} onChange={(v) => set("props", v)} />
        </Field>
      </div>
      <Section title="Motion & camera (for video clips)">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Field label="Motion" hint="one simple movement" htmlFor={fid("motion")}>
            <Input id={fid("motion")} value={form.motion_prompt} placeholder="e.g. he slowly pushes the keys across the desk" onChange={(e) => set("motion_prompt", e.target.value)} />
          </Field>
          <Field label="Camera" htmlFor={fid("camera")}>
            <Select value={form.camera || "static camera"} onValueChange={(v) => set("camera", v)}>
              <SelectTrigger id={fid("camera")} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{cameras.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Label className="font-normal">
          <Switch checked={form.on_camera_speech} onCheckedChange={(v) => set("on_camera_speech", v)} />
          Character speaks on camera (lip-sync; costs extra)
        </Label>
      </Section>
      <Field label="Notes" hint="shown on the storyboard" htmlFor={fid("notes")}>
        <Input id={fid("notes")} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <Section title="Prompt sent to the image model">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">Built from the saved fields{dirty ? " (save to update)" : ""}.</p>
          <CopyButton text={shot.prompt} label="Copy" />
        </div>
        <div className="prompt-block">{shot.prompt}</div>
      </Section>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!dirty || saving} onClick={onSave}><SaveIcon /> Save {shot.id}</Button>
        <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={onReset}><RotateCcwIcon /> Undo changes</Button>
      </div>
    </div>
  );
}

export function ShotsTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shots", id], queryFn: () => api.get<ShotsResp>(`/api/projects/${id}/shots`) });
  const chars = useQuery({ queryKey: ["characters"], queryFn: () => api.get<CharacterList>("/api/characters") });
  const [drafts, setDrafts] = useState<Record<string, Form>>({});
  const [open, setOpen] = useState<string[]>([]);

  const shots = q.data?.shots ?? [];
  const formOf = (s: Shot) => drafts[s.id] ?? toForm(s);
  const dirtyIds = shots.filter((s) => drafts[s.id] && !same(drafts[s.id], toForm(s))).map((s) => s.id);
  const who: Who[] = (chars.data?.characters ?? []).map((c) => ({ name: c.name, label: c.display_name || c.name }));

  const save = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const sid of ids) await api.put(`/api/projects/${id}/shots/${sid}`, drafts[sid]);
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(`Saved ${ids.join(", ")}`);
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !ids.includes(k))));
      qc.invalidateQueries({ queryKey: ["shots", id] });
      qc.invalidateQueries({ queryKey: ["keyframes", id] });
      qc.invalidateQueries({ queryKey: ["lint", id] });
    },
  });

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
  const total = shots.length ? shots[shots.length - 1].end : 0;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{shots.length} shots · {total.toFixed(1)}s</CardTitle>
          <CardDescription>Open a shot to edit what the picture shows. Line text and timing come from the script; images are made in the Keyframes tab.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(open.length ? [] : shots.map((s) => s.id))}>{open.length ? "Collapse all" : "Expand all"}</Button>
            <Button size="sm" disabled={!dirtyIds.length || save.isPending} onClick={() => save.mutate(dirtyIds)}>
              <SaveIcon /> Save all{dirtyIds.length ? ` (${dirtyIds.length})` : ""}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-label="Shot timeline">
            {shots.map((s, i) => (
              <button key={s.id} type="button" title={`${s.id} · ${s.duration.toFixed(1)}s`}
                onClick={() => setOpen((o) => (o.includes(s.id) ? o : [...o, s.id]))}
                className={cn("h-full border-r border-background last:border-r-0", i % 2 ? "bg-primary/60" : "bg-primary", s.approved_keyframe && "bg-success")}
                style={{ width: `${(s.duration / (total || 1)) * 100}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
      <ErrorBox error={save.error} />
      <Card className="py-0">
        <CardContent className="px-4">
          <Accordion type="multiple" value={open} onValueChange={setOpen}>
            {shots.map((s) => {
              const form = formOf(s);
              const dirty = dirtyIds.includes(s.id);
              return (
                <AccordionItem key={s.id} value={s.id}>
                  <AccordionTrigger className="items-center hover:no-underline"><ShotHeader id={id} shot={s} form={form} dirty={dirty} who={who} /></AccordionTrigger>
                  {/* h-auto: nested collapsibles change the height after the row opens */}
                  <AccordionContent className="h-auto pb-4">
                    <ShotEditor
                      shot={s} form={form} framings={q.data!.framings} who={who} dirty={dirty}
                      setForm={(f) => setDrafts((d) => ({ ...d, [s.id]: f }))}
                      onReset={() => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== s.id)))}
                      onSave={() => save.mutate([s.id])} saving={save.isPending}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
      <LintPanel project={id} />
    </div>
  );
}
