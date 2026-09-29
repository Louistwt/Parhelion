import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, ImageIcon, ListVideoIcon, RotateCcwIcon, SaveIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
import en from "../../locales/en/shots";

type ShotsResp = { shots: Shot[] | null; framings: string[]; location_ref: string | null; looks?: Record<string, string> };
type Form = {
  framing: string; setting: string; action: string; notes: string; characters: string[]; props: string[];
  motion_prompt: string; camera: string; on_camera_speech: boolean; looks: Record<string, string>;
};
/** looks: the character's other looks (outfits); the main look is always available as "default". */
type Who = { name: string; label: string; looks: { key: string; label: string }[] };
const DEFAULT_LOOK = "default";
const VIDEO_LOOK = "__video";

// Values stay English (they go to the video model); labels come from shots.cameras.
const CAMERAS = Object.keys(en.cameras) as (keyof typeof en.cameras)[];
const MIN_S = 3, MAX_S = 8;

const toForm = (s: Shot): Form => ({
  framing: s.framing, setting: s.setting, action: s.action, notes: s.notes, characters: s.characters, props: s.props,
  motion_prompt: s.motion_prompt, camera: s.camera, on_camera_speech: s.on_camera_speech, looks: s.looks ?? {},
});
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

type TFn = ReturnType<typeof useTranslation>["t"];
/** Framing keys come from library/prompt_templates.yaml; unknown keys are shown as-is. */
const framingLabel = (t: TFn, f: string) => (f in en.framings ? t(`shots.framings.${f as keyof typeof en.framings}`) : f);
const cameraLabel = (t: TFn, c: string) => (c in en.cameras ? t(`shots.cameras.${c as keyof typeof en.cameras}`) : c);
const lookLabel = (t: TFn, w: Who | undefined, key: string) =>
  key === DEFAULT_LOOK ? t("shots.lookDefault") : (w?.looks.find((l) => l.key === key)?.label ?? key);
const speakerLabel = (t: TFn, who: Who[], name: string) =>
  who.find((w) => w.name === name)?.label ?? (name === "narrator" ? t("shots.narrator") : name);

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}{hint && <span className="font-normal text-muted-foreground"> — {hint}</span>}</Label>
      {children}
    </div>
  );
}

function PropsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const add = () => {
    const v = text.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
      {value.map((p) => (
        <Badge key={p} variant="secondary" className="gap-1 pr-1">
          {p}
          <button type="button" aria-label={t("common.actions.remove", { name: p })} className="rounded-sm opacity-60 hover:opacity-100" onClick={() => onChange(value.filter((x) => x !== p))}>
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id} value={text} placeholder={value.length ? t("shots.fields.propsAdd") : t("shots.fields.propsPlaceholder")}
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
  const { t } = useTranslation();
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
          <span className="text-xs text-muted-foreground tabular-nums">{t("common.seconds", { n: `${shot.start.toFixed(1)}–${shot.end.toFixed(1)}` })}</span>
          <span className="flex items-center gap-1.5 text-xs tabular-nums" title={t("shots.durationRule", { min: MIN_S, max: MAX_S })}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", ok ? "bg-primary-mark" : "bg-destructive")} style={{ width: `${Math.min(100, (shot.duration / MAX_S) * 100)}%` }} />
            </span>
            <span className={ok ? "text-muted-foreground" : "text-destructive"}>{t("common.seconds", { n: shot.duration.toFixed(1) })}</span>
          </span>
          <Badge variant="outline">{framingLabel(t, form.framing)}</Badge>
          {form.characters.map((c) => <Badge key={c} variant="secondary">{who.find((w) => w.name === c)?.label ?? c}</Badge>)}
          {dirty && <Badge variant="warning">{t("common.unsaved")}</Badge>}
        </div>
        <div className="truncate text-sm font-normal text-muted-foreground">{text || t("shots.noLine")}</div>
      </div>
    </div>
  );
}

function ShotEditor({ shot, form, setForm, framings, who, videoLooks, dirty, onSave, saving, onReset }: {
  shot: Shot; form: Form; setForm: (f: Form) => void; framings: string[]; who: Who[]; videoLooks: Record<string, string>;
  dirty: boolean; onSave: () => void; saving: boolean; onReset: () => void;
}) {
  const { t } = useTranslation();
  const fid = (k: string) => `${shot.id}-${k}`;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const cameras = [...new Set([...CAMERAS, ...(form.camera ? [form.camera] : [])])];
  const withLooks = who.filter((w) => form.characters.includes(w.name) && w.looks.length);
  const setLook = (name: string, v: string) => {
    const { [name]: _old, ...rest } = form.looks;
    set("looks", v === VIDEO_LOOK ? rest : { ...rest, [name]: v });
  };
  return (
    <div className="flex flex-col gap-4 pt-1">
      {shot.lines.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2">
          {shot.lines.map((l) => (
            <div key={l.id} className="text-[15px]"><span className="mr-2 text-xs text-muted-foreground">{l.id} · {speakerLabel(t, who, l.speaker)}</span>{l.text}</div>
          ))}
        </div>
      )}
      <Field label={t("shots.fields.action")} hint={t("shots.fields.actionHint")} htmlFor={fid("action")}>
        <Textarea id={fid("action")} rows={3} value={form.action} onChange={(e) => set("action", e.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Field label={t("shots.fields.framing")} htmlFor={fid("framing")}>
          <Select value={form.framing} onValueChange={(v) => set("framing", v)}>
            <SelectTrigger id={fid("framing")} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([...framings, form.framing])].map((f) => <SelectItem key={f} value={f}>{framingLabel(t, f)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={t("shots.fields.setting")} htmlFor={fid("setting")}>
          <Textarea id={fid("setting")} rows={2} value={form.setting} onChange={(e) => set("setting", e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Field label={t("shots.fields.who")}>
          {who.length ? (
            <ToggleGroup type="multiple" variant="outline" size="sm" value={form.characters} onValueChange={(v) => set("characters", v)} className="flex-wrap">
              {who.map((w) => <ToggleGroupItem key={w.name} value={w.name} aria-label={w.label}>{w.label}</ToggleGroupItem>)}
            </ToggleGroup>
          ) : <span className="text-sm text-muted-foreground">{t("shots.fields.noCharacters")}</span>}
        </Field>
        <Field label={t("shots.fields.props")} htmlFor={fid("props")}>
          <PropsInput id={fid("props")} value={form.props} onChange={(v) => set("props", v)} />
        </Field>
      </div>
      {withLooks.length > 0 && (
        <Field label={t("shots.fields.looks")} hint={t("shots.fields.looksHint")}>
          <div className="flex flex-wrap gap-3">
            {withLooks.map((w) => (
              <div key={w.name} className="flex items-center gap-2 text-sm">
                <span>{w.label}</span>
                <Select value={form.looks[w.name] ?? VIDEO_LOOK} onValueChange={(v) => setLook(w.name, v)}>
                  <SelectTrigger aria-label={t("shots.fields.lookFor", { name: w.label })} className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VIDEO_LOOK}>{t("shots.fields.lookVideo", { look: lookLabel(t, w, videoLooks[w.name] ?? DEFAULT_LOOK) })}</SelectItem>
                    {[DEFAULT_LOOK, ...w.looks.map((l) => l.key)].map((k) => <SelectItem key={k} value={k}>{lookLabel(t, w, k)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Field>
      )}
      <Section title={t("shots.fields.motionSection")}>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Field label={t("shots.fields.motion")} hint={t("shots.fields.motionHint")} htmlFor={fid("motion")}>
            <Input id={fid("motion")} value={form.motion_prompt} placeholder={t("shots.fields.motionPlaceholder")} onChange={(e) => set("motion_prompt", e.target.value)} />
          </Field>
          <Field label={t("shots.fields.camera")} htmlFor={fid("camera")}>
            <Select value={form.camera || "static camera"} onValueChange={(v) => set("camera", v)}>
              <SelectTrigger id={fid("camera")} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{cameras.map((c) => <SelectItem key={c} value={c}>{cameraLabel(t, c)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Label className="font-normal">
          <Switch checked={form.on_camera_speech} onCheckedChange={(v) => set("on_camera_speech", v)} />
          {t("shots.fields.speaks")}
        </Label>
      </Section>
      <Field label={t("shots.fields.notes")} hint={t("shots.fields.notesHint")} htmlFor={fid("notes")}>
        <Input id={fid("notes")} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <Section title={t("shots.fields.promptSection")}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{dirty ? t("shots.fields.promptBuiltDirty") : t("shots.fields.promptBuilt")}</p>
          <CopyButton text={shot.prompt} />
        </div>
        <div className="prompt-block">{shot.prompt}</div>
      </Section>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!dirty || saving} onClick={onSave}><SaveIcon /> {t("shots.saveShot", { id: shot.id })}</Button>
        <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={onReset}><RotateCcwIcon /> {t("common.actions.undo")}</Button>
      </div>
    </div>
  );
}

export function ShotsTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shots", id], queryFn: () => api.get<ShotsResp>(`/api/projects/${id}/shots`) });
  const chars = useQuery({ queryKey: ["characters"], queryFn: () => api.get<CharacterList>("/api/characters") });
  const [drafts, setDrafts] = useState<Record<string, Form>>({});
  const [open, setOpen] = useState<string[]>([]);

  const shots = q.data?.shots ?? [];
  const formOf = (s: Shot) => drafts[s.id] ?? toForm(s);
  const dirtyIds = shots.filter((s) => drafts[s.id] && !same(drafts[s.id], toForm(s))).map((s) => s.id);
  const who: Who[] = (chars.data?.characters ?? []).map((c) => ({
    name: c.name, label: c.display_name || c.name,
    looks: Object.entries(c.looks ?? {}).map(([key, l]) => ({ key, label: l.label || key })),
  }));

  const save = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const sid of ids) await api.put(`/api/projects/${id}/shots/${sid}`, drafts[sid]);
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(t("shots.savedToast", { ids: ids.join(", ") }));
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !ids.includes(k))));
      qc.invalidateQueries({ queryKey: ["shots", id] });
      qc.invalidateQueries({ queryKey: ["keyframes", id] });
      qc.invalidateQueries({ queryKey: ["lint", id] });
    },
  });

  const setRoom = useMutation({
    mutationFn: (location_ref: string) => api.put(`/api/projects/${id}/shotlist`, { location_ref }),
    onSuccess: () => { toast.success(t("shots.roomSavedToast")); qc.invalidateQueries({ queryKey: ["shots", id] }); qc.invalidateQueries({ queryKey: ["lint", id] }); },
    onError: (e) => toast.error(String(e)),
  });

  // English in every language: it is pasted into Claude Code.
  const prompt = t("shots.claudePrompt", { id });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data?.shots) {
    return (
      <div className="flex flex-col gap-4">
        <Empty title={t("shots.empty.title")} icon={ListVideoIcon}>{t("shots.empty.body")}</Empty>
        <Card>
          <CardHeader>
            <CardTitle>{t("shots.promptTitle")}</CardTitle>
            <CardAction><CopyButton text={prompt} label={t("shots.copyPrompt")} /></CardAction>
          </CardHeader>
          <CardContent><div className="prompt-block">{prompt}</div></CardContent>
        </Card>
      </div>
    );
  }
  const total = shots.length ? shots[shots.length - 1].end : 0;
  const roomOptions = shots.filter((s) => s.approved_keyframe).map((s) => `keyframes/${s.approved_keyframe}`);
  const room = q.data.location_ref;
  const videoLooks = q.data.looks ?? {};
  const inVideo = new Set(shots.flatMap((s) => s.characters));
  const lookWho = who.filter((w) => inVideo.has(w.name) && w.looks.length);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("shots.summary", { count: shots.length, seconds: total.toFixed(1) })}</CardTitle>
          <CardDescription>{t("shots.description")}</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(open.length ? [] : shots.map((s) => s.id))}>{open.length ? t("shots.collapseAll") : t("shots.expandAll")}</Button>
            <Button size="sm" disabled={!dirtyIds.length || save.isPending} onClick={() => save.mutate(dirtyIds)}>
              <SaveIcon /> {dirtyIds.length ? t("shots.saveAllCount", { count: dirtyIds.length }) : t("common.actions.saveAll")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Label htmlFor="room-ref">{t("shots.roomRef")}</Label>
            <Select value={room ?? "__none"} onValueChange={(v) => setRoom.mutate(v === "__none" ? "" : v)}>
              <SelectTrigger id="room-ref" className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("shots.roomNone")}</SelectItem>
                {[...new Set([...(room ? [room] : []), ...roomOptions])].map((r) => <SelectItem key={r} value={r}>{r.replace("keyframes/", "").replace(/\.\w+$/, "")}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">{t("shots.roomHint")}</span>
          </div>
          {lookWho.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{t("shots.looks")}</span>
              {lookWho.map((w) => (
                <Badge key={w.name} variant="secondary">{w.label}: {lookLabel(t, w, videoLooks[w.name] ?? DEFAULT_LOOK)}</Badge>
              ))}
              <Link to={`/p/${id}/brief`} className="text-primary-ink underline-offset-2 hover:underline">{t("shots.looksHint")}</Link>
            </div>
          )}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={t("shots.timeline")}>
            {shots.map((s, i) => (
              <button key={s.id} type="button" title={`${s.id} · ${t("common.seconds", { n: s.duration.toFixed(1) })}`}
                onClick={() => setOpen((o) => (o.includes(s.id) ? o : [...o, s.id]))}
                className={cn("h-full border-r border-background last:border-r-0", i % 2 ? "bg-primary-mark/60" : "bg-primary-mark", s.approved_keyframe && "bg-success")}
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
                      shot={s} form={form} framings={q.data!.framings} who={who} videoLooks={videoLooks} dirty={dirty}
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
