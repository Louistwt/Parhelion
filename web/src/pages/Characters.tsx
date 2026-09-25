import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, Character, fileUrl, RunRequest, VoiceCatalog } from "../api";
import { Empty, ErrorBox, Loading, PageHeader } from "../components/common";
import { JobProgress } from "../components/JobProgress";
import { Lightbox } from "../components/Lightbox";
import { ModelSelect } from "../components/ModelSelect";
import { SpendModal } from "../components/SpendModal";
import { Thumb, ThumbEmpty, ThumbGrid } from "../components/Thumb";
import { useSettings } from "../format";
import { useScopeJob } from "../jobs";

function VoicePicker({ c, onGenerate }: { c: Character; onGenerate: (r: RunRequest) => void }) {
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["voices"], queryFn: () => api.get<VoiceCatalog>("/api/voices"), staleTime: Infinity });
  const [lang, setLang] = useState<"mandarin" | "cantonese">(c.voice?.voice_id.startsWith("Cantonese") ? "cantonese" : "mandarin");
  const [voiceId, setVoiceId] = useState(c.voice?.voice_id ?? "");
  const [speed, setSpeed] = useState(c.voice?.speed ?? 1);
  const [emotion, setEmotion] = useState(c.voice?.emotion ?? "none");
  const [sample, setSample] = useState("你好，我是" + (c.display_name || c.name) + "。今天我们聊聊保险。");
  const dirty = voiceId !== (c.voice?.voice_id ?? "") || speed !== (c.voice?.speed ?? 1) || emotion !== (c.voice?.emotion ?? "none");
  const save = useMutation({
    mutationFn: () => api.put(`/api/characters/${c.name}`, { voice: voiceId ? { voice_id: voiceId, speed, pitch: 0, emotion: emotion === "none" ? null : emotion } : {} }),
    onSuccess: () => { toast.success(`${c.name}: voice saved`); qc.invalidateQueries({ queryKey: ["characters"] }); },
  });
  const options = cat.data?.catalog[lang] ?? [];
  const previews = c.voice_previews.filter((f) => f.startsWith(`voice_preview_${lang}_`));
  const latest = previews[previews.length - 1];
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="text-sm font-medium">Voice <span className="font-normal text-muted-foreground">— a human choice; used for every line this character speaks</span></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Language</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "mandarin" | "cantonese")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="mandarin">普通话</SelectItem><SelectItem value="cantonese">粤语</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Voice</Label>
          <Select value={voiceId || "__none"} onValueChange={(v) => setVoiceId(v === "__none" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pick a voice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— none —</SelectItem>
              {voiceId && !options.some((o) => o.id === voiceId) && <SelectItem value={voiceId}>{voiceId}</SelectItem>}
              {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${c.name}-speed`} className="text-xs text-muted-foreground">Speed</Label>
          <Input id={`${c.name}-speed`} type="number" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Default emotion</Label>
          <Select value={emotion} onValueChange={setEmotion}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">auto</SelectItem>
              {(cat.data?.emotions ?? []).map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> Save voice</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${c.name}-sample`} className="text-xs text-muted-foreground">Preview text</Label>
          <Input id={`${c.name}-sample`} value={sample} onChange={(e) => setSample(e.target.value)} />
        </div>
        <Button variant="outline" disabled={!c.voice || dirty} title={dirty ? "Save the voice first" : undefined}
          onClick={() => onGenerate({ kind: "voice_preview", name: c.name, text: sample, language: lang })}>
          <SparklesIcon /> Preview (≈ $0.003)
        </Button>
        {latest && (
          <div className="flex items-center gap-2">
            <audio key={latest} controls preload="none" src={fileUrl("library", "characters", c.name, latest)} className="h-8" />
            <span className="text-xs text-muted-foreground">{latest.replace(/\.\w+$/, "")}</span>
          </div>
        )}
      </div>
      <ErrorBox error={save.error} />
    </div>
  );
}

function CharacterCard({ c, onGenerate }: { c: Character; onGenerate: (r: RunRequest) => void }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const [display, setDisplay] = useState(c.display_name);
  const [block, setBlock] = useState(c.prompt_block);
  const [model, setModel] = useState("");
  const [useRefs, setUseRefs] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["characters"] });
  const save = useMutation({
    mutationFn: () => api.put(`/api/characters/${c.name}`, { display_name: display, prompt_block: block }),
    onSuccess: () => { toast.success(`${c.name} saved`); refresh(); },
  });
  const toggle = useMutation({
    mutationFn: (name: string) => {
      const v = name.match(/_v(\d+)\./)?.[1];
      const action = c.approved_sheets.includes(name) ? "unapprove" : "approve";
      return api.post(`/api/characters/${c.name}/sheets/v${v}/${action}`);
    },
    onSuccess: (_, name) => { toast.success(`${name} ${c.approved_sheets.includes(name) ? "unapproved" : "approved as reference"}`); refresh(); },
  });
  const dirty = display !== c.display_name || block !== c.prompt_block;
  const images = c.sheets.map((s) => ({ name: s, src: fileUrl("library", "characters", c.name, s) }));
  const n = settings.data?.pipeline.characters.variants ?? 2;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{c.display_name || c.name} <span className="font-mono text-xs font-normal text-muted-foreground">{c.name}</span></CardTitle>
        <CardAction><Badge variant={c.approved_sheets.length ? "success" : "warning"}>{c.approved_sheets.length} approved sheet(s)</Badge></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${c.name}-dn`}>Display name</Label>
            <Input id={`${c.name}-dn`} value={display} onChange={(e) => setDisplay(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${c.name}-pb`}>Look — sent to the image model (appearance only, no text)</Label>
            <Textarea id={`${c.name}-pb`} rows={3} value={block} onChange={(e) => setBlock(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> Save description</Button>
          {dirty && <span className="text-sm text-warning">Save before generating — the saved text is what gets sent.</span>}
        </div>
        <ErrorBox error={save.error} />
        <VoicePicker c={c} onGenerate={onGenerate} />
        <ThumbGrid>
          {images.map((im, i) => (
            <Thumb key={im.name} src={im.src} label={im.name.replace(/\.\w+$/, "")} approved={c.approved_sheets.includes(im.name)} onClick={() => setOpen(i)} />
          ))}
          {images.length === 0 && <ThumbEmpty label="no sheets yet" />}
        </ThumbGrid>
        <div className="flex flex-wrap items-end gap-4">
          <ModelSelect id={`${c.name}-model`} value={model} onChange={setModel} />
          <Label className="font-normal">
            <Checkbox checked={useRefs} disabled={!c.approved_sheets.length} onCheckedChange={(v) => setUseRefs(v === true)} />
            refine from approved sheets
          </Label>
          <Button disabled={dirty} onClick={() => onGenerate({ kind: "character", name: c.name, n, model: model || undefined, use_approved: useRefs })}>
            <SparklesIcon /> Generate {n} sheet(s)
          </Button>
        </div>
      </CardContent>
      {open !== null && (
        <Lightbox
          title={`${c.display_name || c.name} — Approve toggles a sheet as reference`}
          images={images}
          approved={c.approved_sheets}
          start={open}
          onApprove={(name) => toggle.mutate(name)}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}

function NewCharacter() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [display, setDisplay] = useState("");
  const [block, setBlock] = useState("");
  const m = useMutation({
    mutationFn: () => api.post("/api/characters", { name, display_name: display, prompt_block: block }),
    onSuccess: () => {
      toast.success(`Added ${display || name}`);
      setName(""); setDisplay(""); setBlock("");
      qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  return (
    <Card>
      <CardHeader>
        <CardTitle>New character</CardTitle>
        <CardDescription>Describe the look only: age, build, hair, clothes, colours, a signature prop.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr]">
            <div className="flex flex-col gap-1.5"><Label htmlFor="nc-id">ID</Label><Input id="nc-id" value={name} onChange={(e) => setName(e.target.value)} placeholder="zhangshu" required /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="nc-dn">Display name</Label><Input id="nc-dn" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="张叔" /></div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nc-look">Look</Label>
              <Textarea id="nc-look" rows={2} value={block} onChange={(e) => setBlock(e.target.value)} placeholder="A man in his 60s, round face, grey buzz cut, white singlet, holding a steaming teacup" required />
            </div>
          </div>
          <div><Button type="submit" disabled={m.isPending}><PlusIcon /> Add character</Button></div>
          <ErrorBox error={m.error} />
        </form>
      </CardContent>
    </Card>
  );
}

export function Characters() {
  const q = useQuery({ queryKey: ["characters"], queryFn: () => api.get<{ characters: Character[] }>("/api/characters") });
  const [pending, setPending] = useState<RunRequest | null>(null);
  const { jobId, setJob } = useScopeJob("characters", (j) => j.kind === "character" || j.kind === "voice_preview");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Characters" description="Reference sheets are shared by every video. Approved sheets are sent as references for keyframes." />
      {jobId && <JobProgress jobId={jobId} invalidate={[["characters"], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {q.data && q.data.characters.length === 0 && <Empty title="No characters yet">Add one below — describe the look only.</Empty>}
      {q.data?.characters.map((c) => <CharacterCard key={`${c.name}-${c.prompt_block}-${c.display_name}`} c={c} onGenerate={setPending} />)}
      <NewCharacter />
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
