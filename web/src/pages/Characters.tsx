import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, PinIcon, PlusIcon, SaveIcon, ScanFaceIcon, SparklesIcon, Trash2Icon, UploadIcon, UsersIcon } from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api, Character, CharacterList, fileUrl, RunRequest, VoiceCatalog } from "../api";
import { CostChip, Empty, ErrorBox, Loading, PageHeader } from "../components/common";
import { JobProgress } from "../components/JobProgress";
import { Lightbox } from "../components/Lightbox";
import { ModelSelect } from "../components/ModelSelect";
import { SpendModal } from "../components/SpendModal";
import { Thumb, ThumbEmpty, ThumbGrid } from "../components/Thumb";
import { useSettings } from "../format";
import { useScopeJob } from "../jobs";
import { CharacterWizard } from "./CharacterWizard";

function VoicePicker({ c, onGenerate }: { c: Character; onGenerate: (r: RunRequest) => void }) {
  const { t } = useTranslation();
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
    onSuccess: () => { toast.success(t("characters.voice.saved", { name: c.name })); qc.invalidateQueries({ queryKey: ["characters"] }); },
  });
  const options = cat.data?.catalog[lang] ?? [];
  const previews = c.voice_previews.filter((f) => f.startsWith(`voice_preview_${lang}_`));
  const latest = previews[previews.length - 1];
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="text-sm font-medium">{t("characters.voice.heading")} <span className="font-normal text-muted-foreground">{t("characters.voice.headingNote")}</span></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("characters.voice.language")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "mandarin" | "cantonese")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="mandarin">{t("characters.languages.mandarin")}</SelectItem><SelectItem value="cantonese">{t("characters.languages.cantonese")}</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("characters.voice.voice")}</Label>
          <Select value={voiceId || "__none"} onValueChange={(v) => setVoiceId(v === "__none" ? "" : v)}>
            <SelectTrigger className="w-64"><SelectValue placeholder={t("characters.voice.pick")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{t("characters.voice.none")}</SelectItem>
              {voiceId && !options.some((o) => o.id === voiceId) && <SelectItem value={voiceId}>{voiceId}</SelectItem>}
              {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${c.name}-speed`} className="text-xs text-muted-foreground">{t("characters.voice.speed")}</Label>
          <Input id={`${c.name}-speed`} type="number" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("characters.voice.emotion")}</Label>
          <Select value={emotion} onValueChange={setEmotion}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("characters.voice.emotionAuto")}</SelectItem>
              {(cat.data?.emotions ?? []).map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> {t("characters.voice.save")}</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${c.name}-sample`} className="text-xs text-muted-foreground">{t("characters.voice.previewText")}</Label>
          <Input id={`${c.name}-sample`} value={sample} onChange={(e) => setSample(e.target.value)} />
        </div>
        <Button variant="spend" disabled={!c.voice || dirty} title={dirty ? t("characters.voice.saveFirst") : undefined}
          onClick={() => onGenerate({ kind: "voice_preview", name: c.name, text: sample, language: lang })}>
          <SparklesIcon /> {t("characters.voice.preview")} <CostChip>≈ $0.003</CostChip>
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

export type Styles = { styles: string[]; default_style: string };

const DEFAULT_LOOK = "default";
const NEW_LOOK = "__new";

const STYLE_NAMES = {
  cartoon: "characters.styleNames.cartoon", realistic: "characters.styleNames.realistic", cartoon3d: "characters.styleNames.cartoon3d",
} as const;
const INHERIT = "__inherit";
type TFn = ReturnType<typeof useTranslation>["t"];
export const styleLabel = (t: TFn, s: string) => (s in STYLE_NAMES ? t(STYLE_NAMES[s as keyof typeof STYLE_NAMES]) : s);

export function StyleSelect({ id, value, onChange, styles, inherit }: {
  id: string; value: string; onChange: (v: string) => void; styles: Styles; inherit?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {inherit && <SelectItem value={INHERIT}>{inherit}</SelectItem>}
        {styles.styles.map((s) => <SelectItem key={s} value={s}>{s === styles.default_style ? t("characters.styleDefault", { style: styleLabel(t, s) }) : styleLabel(t, s)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** The full-body sheet keyframes get for a look: its pinned reference if still approved, else the latest approved (not the face photo). */
export function lookReference(c: Character, look: string): string | undefined {
  const holder = look === DEFAULT_LOOK ? c : c.looks[look];
  if (!holder) return undefined;
  const sheets = holder.approved_sheets.filter((s) => s !== c.face_ref);
  return holder.reference && sheets.includes(holder.reference) ? holder.reference : sheets[sheets.length - 1];
}

/** Give an image a human name (the file keeps its versioned name). Saved on Enter or when leaving the field. */
function SheetName({ c, file }: { c: Character; file: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const saved = c.sheet_names[file] ?? "";
  const [text, setText] = useState(saved);
  const save = useMutation({
    mutationFn: () => api.put(`/api/characters/${c.name}/sheets/v${file.match(/_v(\d+)\./)?.[1]}/name`, { name: text }),
    onSuccess: () => { toast.success(t("characters.card.nameSaved")); qc.invalidateQueries({ queryKey: ["characters"] }); },
    onError: (e) => toast.error(String(e)),
  });
  return (
    <Input aria-label={t("characters.card.imageName")} value={text} placeholder={t("characters.card.imageNamePlaceholder")}
      onChange={(e) => setText(e.target.value)} className="h-8 w-48"
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && text !== saved) save.mutate(); }}
      onBlur={() => { if (text !== saved) save.mutate(); }} />
  );
}

/** One numbered step of a character: 1 Face · 2 Voice · 3 Looks (same order as the new-character wizard). */
function CardSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{n}</span>{title}
      </h3>
      {children}
    </section>
  );
}

/** A real photo of the person: uploaded with consent, it becomes the face reference sent with every sheet and keyframe. */
function FacePhoto({ c, onGenerate }: { c: Character; onGenerate: (r: RunRequest) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      return api.post<{ file: string }>(`/api/characters/${c.name}/photo`, { filename: file.name, data, consent });
    },
    onSuccess: (r) => { toast.success(t("characters.card.photoUploaded", { name: r.file })); setConsent(false); qc.invalidateQueries({ queryKey: ["characters"] }); },
    onError: (e) => toast.error(String(e)),
  });
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t("characters.card.facePhoto")}</Label>
      <div className="flex items-start gap-2">
        <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {c.face_ref
            ? <img src={fileUrl("library", "characters", c.name, c.face_ref)} alt={t("characters.card.facePhoto")} className="size-full object-cover" />
            : <ScanFaceIcon className="m-auto mt-5 size-5 text-muted-foreground" />}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
        <Button type="button" variant="outline" size="sm" disabled={!consent || upload.isPending} onClick={() => input.current?.click()}>
          <UploadIcon /> {t("characters.card.uploadPhoto")}
        </Button>
        <input ref={input} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
        {!c.face_ref && (
          <Button type="button" variant="spend" size="sm" title={t("characters.card.generateFaceTitle")}
            onClick={() => onGenerate({ kind: "character", name: c.name, n: 1, face_only: true })}>
            <SparklesIcon /> {t("characters.card.generateFace")} <CostChip>≈ $0.03</CostChip>
          </Button>
        )}
        </div>
      </div>
      <Label className="text-xs font-normal text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
        {t("characters.card.photoConsent")}
      </Label>
    </div>
  );
}

function CharacterCard({ c, styles, onGenerate }: { c: Character; styles: Styles; onGenerate: (r: RunRequest) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useSettings();
  const savedStyle = c.style ?? styles.default_style;
  const [display, setDisplay] = useState(c.display_name);
  const [style, setStyle] = useState(savedStyle);
  const [model, setModel] = useState("");
  const [useRefs, setUseRefs] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  // The person (prompt_block) is shared; each look only has an outfit. "default" = the main look (c.outfit + c.approved_sheets);
  // others live in c.looks. NEW_LOOK = the "+ New look" form.
  const [person, setPerson] = useState(c.prompt_block);
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [newKey, setNewKey] = useState("");
  const [outfits, setOutfits] = useState<Record<string, string>>({}); // unsaved outfit per look
  const [labels, setLabels] = useState<Record<string, string>>({}); // unsaved look names
  const [lookStyles, setLookStyles] = useState<Record<string, string>>({}); // unsaved look style ("" = character's)
  const [lookFaces, setLookFaces] = useState<Record<string, boolean>>({}); // unsaved "send face photo" per look
  const isNew = look === NEW_LOOK;
  const named = look !== DEFAULT_LOOK && !isNew;
  const savedOutfit = look === DEFAULT_LOOK ? c.outfit : (c.looks[look]?.outfit ?? "");
  const savedLabel = named ? (c.looks[look]?.label ?? "") : "";
  const outfit = outfits[look] ?? savedOutfit;
  const label = labels[look] ?? savedLabel;
  const savedLookStyle = named ? (c.looks[look]?.style ?? "") : "";
  const savedLookFace = named ? (c.looks[look]?.use_face_ref ?? true) : true;
  const lookStyle = lookStyles[look] ?? savedLookStyle;
  const lookFace = lookFaces[look] ?? savedLookFace;
  const approved = look === DEFAULT_LOOK ? c.approved_sheets : (c.looks[look]?.approved_sheets ?? []);
  const lookName = (k: string) => (k === DEFAULT_LOOK ? t("characters.card.lookDefault") : c.looks[k]?.label || k);
  const refresh = () => qc.invalidateQueries({ queryKey: ["characters"] });
  const save = useMutation({
    mutationFn: async () => {
      const key = isNew ? newKey.trim() : look;
      await api.put(`/api/characters/${c.name}`, { display_name: display, style, prompt_block: person, ...(look === DEFAULT_LOOK ? { outfit } : {}) });
      if (key !== DEFAULT_LOOK) await api.put(`/api/characters/${c.name}/looks/${key}`, { label, outfit, style: lookStyle || null, use_face_ref: lookFace });
      return key;
    },
    onSuccess: (key) => {
      toast.success(t("characters.card.saved", { name: c.name }));
      setOutfits(({ [look]: _o, ...rest }) => rest);
      setLabels(({ [look]: _l, ...rest }) => rest);
      setLookStyles(({ [look]: _s, ...rest }) => rest);
      setLookFaces(({ [look]: _f, ...rest }) => rest);
      if (isNew) { setLook(key); setNewKey(""); }
      refresh();
    },
  });
  const removeLook = useMutation({
    mutationFn: () => api.delete(`/api/characters/${c.name}/looks/${look}`),
    onSuccess: () => { toast.success(t("characters.card.lookDeleted", { look: lookName(look) })); setLook(DEFAULT_LOOK); refresh(); },
    onError: (e) => toast.error(String(e)),
  });
  const lookQuery = look === DEFAULT_LOOK ? "" : `?look=${encodeURIComponent(look)}`;
  const toggle = useMutation({
    mutationFn: (name: string) => {
      const v = name.match(/_v(\d+)\./)?.[1];
      const action = approved.includes(name) ? "unapprove" : "approve";
      return api.post(`/api/characters/${c.name}/sheets/v${v}/${action}${lookQuery}`);
    },
    onSuccess: (_, name) => { toast.success(t(approved.includes(name) ? "characters.card.unapproved" : "characters.card.approvedAsReference", { name })); refresh(); },
  });
  const setFace = useMutation({
    mutationFn: (name: string) => api.put(`/api/characters/${c.name}`, { face_ref: c.face_ref === name ? "" : name }),
    onSuccess: (_, name) => { toast.success(c.face_ref === name ? t("characters.card.faceCleared") : t("characters.card.faceSet", { name })); refresh(); },
    onError: (e) => toast.error(String(e)),
  });
  const pin = useMutation({
    mutationFn: (name: string) => api.post(`/api/characters/${c.name}/sheets/v${name.match(/_v(\d+)\./)?.[1]}/reference${lookQuery}`),
    onSuccess: (_, name) => { toast.success(t("characters.card.pinnedToast", { name: sheetLabel(name), look: lookName(look) })); refresh(); },
    onError: (e) => toast.error(String(e)),
  });
  const discard = useMutation({
    mutationFn: (name: string) => api.post(`/api/characters/${c.name}/sheets/v${name.match(/_v(\d+)\./)?.[1]}/discard`),
    onSuccess: (_, name) => { toast.success(t("characters.card.discarded", { name })); refresh(); },
    onError: (e) => toast.error(String(e)),
  });
  const dirty = display !== c.display_name || person !== c.prompt_block || outfit !== savedOutfit || label !== savedLabel || style !== savedStyle || lookStyle !== savedLookStyle || lookFace !== savedLookFace || isNew;
  const images = c.sheets.map((s) => ({ name: s, src: fileUrl("library", "characters", c.name, s) }));
  const lookKeys = [DEFAULT_LOOK, ...Object.keys(c.looks)];
  const reference = isNew ? undefined : lookReference(c, look);
  const sheetLabel = (f: string) => c.sheet_names[f] || f.replace(/\.\w+$/, "");
  const otherLook = (s: string) => [DEFAULT_LOOK, ...Object.keys(c.looks)].find((k) => k !== look && (k === DEFAULT_LOOK ? c.approved_sheets : c.looks[k].approved_sheets).includes(s));
  const n = settings.data?.pipeline.characters.variants ?? 2;
  const sendsFace = !!c.face_ref && (look === DEFAULT_LOOK || lookFace);
  const canSave = dirty && !save.isPending && !!person.trim() && !(isNew && (!newKey.trim() || !outfit.trim()));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{c.display_name || c.name} <span className="font-mono text-xs font-normal text-muted-foreground">{c.name}</span></CardTitle>
        <CardAction className="flex items-center gap-2">
          <Badge variant={reference ? "success" : "warning"} title={t("characters.card.referenceTitle")}>
            {reference ? t("characters.card.reference", { name: reference.replace(/\.\w+$/, "") }) : t("characters.card.noReference")}{c.face_ref ? t("characters.card.face", { name: c.face_ref.replace(/\.\w+$/, "") }) : ""}
          </Badge>
          <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!canSave} onClick={() => save.mutate()}><SaveIcon /> {t("characters.card.saveDescription")}</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {dirty && <p className="-mt-2 text-sm text-warning">{t("characters.card.saveBeforeGenerating")}</p>}
        <ErrorBox error={save.error} />
        <CardSection n={1} title={t("characters.card.sectionFace")}>
          <div className="grid gap-3 sm:grid-cols-[290px_1fr]">
            <div className="flex flex-col gap-3">
              <FacePhoto c={c} onGenerate={onGenerate} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${c.name}-dn`}>{t("characters.card.displayName")}</Label>
                <Input id={`${c.name}-dn`} value={display} onChange={(e) => setDisplay(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${c.name}-pb`}>{t("characters.card.person")}</Label>
              <Textarea id={`${c.name}-pb`} rows={5} value={person} onChange={(e) => setPerson(e.target.value)} />
            </div>
          </div>
        </CardSection>
        <CardSection n={2} title={t("characters.card.sectionVoice")}>
          <VoicePicker c={c} onGenerate={onGenerate} />
        </CardSection>
        <CardSection n={3} title={t("characters.card.sectionLooks")}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5" role="listbox" aria-label={t("characters.card.lookSelect")}>
            {lookKeys.map((k) => {
              const ref = lookReference(c, k);
              const st = k === DEFAULT_LOOK ? savedStyle : (c.looks[k]?.style || savedStyle);
              return (
                <button key={k} type="button" role="option" aria-selected={look === k} onClick={() => setLook(k)}
                  className={cn("flex flex-col overflow-hidden rounded-lg border-2 text-left transition hover:bg-muted/50",
                    look === k ? "border-primary" : "border-border")}>
                  <div className="aspect-video w-full bg-muted">
                    {ref ? <img src={fileUrl("library", "characters", c.name, ref)} alt="" className="size-full object-cover" />
                      : <span className="flex size-full items-center justify-center text-xs text-muted-foreground">{t("characters.card.noReference")}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-sm font-medium">{lookName(k)}</span>
                    <Badge variant="outline" className="shrink-0">{styleLabel(t, st)}</Badge>
                  </div>
                </button>
              );
            })}
            <button type="button" role="option" aria-selected={isNew} onClick={() => setLook(NEW_LOOK)}
              className={cn("flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition hover:bg-muted/50",
                isNew ? "border-primary" : "border-border")}>
              <PlusIcon className="size-4" /> {t("characters.card.lookNew")}
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{isNew ? t("characters.card.lookNewName") : lookName(look)}</span>
              {isNew && (
                <Input aria-label={t("characters.card.lookKey")} value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-8 w-32"
                  placeholder="anchor" // i18n-ignore: example id (data)
                />
              )}
              {(named || isNew) && (
                <Input aria-label={t("characters.card.lookLabel")} value={label} onChange={(e) => setLabels({ ...labels, [look]: e.target.value })}
                  className="h-8 w-36" placeholder={t("characters.card.lookLabelPlaceholder")} />
              )}
              {named && (
                <Button variant="ghost" size="sm" className="ml-auto" disabled={removeLook.isPending} onClick={() => removeLook.mutate()} title={t("characters.card.lookDeleteTitle")}>
                  <Trash2Icon /> {t("characters.card.lookDelete")}
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${c.name}-style`}>{look === DEFAULT_LOOK ? t("characters.card.style") : t("characters.card.lookStyle")}</Label>
                  {look === DEFAULT_LOOK
                    ? <StyleSelect id={`${c.name}-style`} value={style} onChange={setStyle} styles={styles} />
                    : <StyleSelect id={`${c.name}-style`} value={lookStyle || INHERIT} onChange={(v) => setLookStyles({ ...lookStyles, [look]: v === INHERIT ? "" : v })}
                        styles={styles} inherit={t("characters.card.lookStyleInherit", { style: styleLabel(t, savedStyle) })} />}
                </div>
                {look !== DEFAULT_LOOK && (
                  <Label className="text-sm font-normal">
                    <Checkbox checked={lookFace} disabled={!c.face_ref} onCheckedChange={(v) => setLookFaces({ ...lookFaces, [look]: v === true })} />
                    {t("characters.card.lookUseFace")}
                  </Label>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${c.name}-outfit`}>{t("characters.card.outfit", { look: isNew ? t("characters.card.lookNewName") : lookName(look) })}</Label>
                <Textarea id={`${c.name}-outfit`} rows={3} value={outfit} onChange={(e) => setOutfits({ ...outfits, [look]: e.target.value })}
                  placeholder={look === DEFAULT_LOOK && !c.outfit ? t("characters.card.outfitEmptyMain") : t("characters.card.lookNewPlaceholder")} />
                {look !== DEFAULT_LOOK && <p className="text-xs text-muted-foreground">{t("characters.card.lookHint")}</p>}
              </div>
            </div>
            {!isNew && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{t("characters.card.images")}</span>
                  <span className="text-xs text-muted-foreground">{t("characters.card.imagesHint", { look: lookName(look) })}</span>
                </div>
                <ThumbGrid wide>
                  {images.map((im, i) => (
                    <Thumb key={im.name} wide src={im.src} approved={approved.includes(im.name)} onClick={() => setOpen(i)}
                      mark={im.name === reference ? t("characters.card.referenceMark") : im.name === c.face_ref ? t("characters.card.faceMark") : undefined}
                      label={sheetLabel(im.name) + (otherLook(im.name) ? t("characters.card.thumbLook", { look: lookName(otherLook(im.name)!) }) : "")} />
                  ))}
                  {images.length === 0 && <ThumbEmpty wide label={t("characters.card.noSheets")} />}
                </ThumbGrid>
                <div className="flex flex-wrap items-end gap-4">
                  <ModelSelect id={`${c.name}-model`} value={model} onChange={setModel} />
                  <Label className="font-normal">
                    <Checkbox checked={useRefs} disabled={!approved.length && !c.face_ref && !c.approved_sheets.length} onCheckedChange={(v) => setUseRefs(v === true)} />
                    {t("characters.card.refine")}
                  </Label>
                  <Button variant="spend" disabled={dirty}
                    onClick={() => onGenerate({ kind: "character", name: c.name, n, model: model || undefined, use_approved: useRefs, look: look === DEFAULT_LOOK ? undefined : look })}>
                    <SparklesIcon /> {t("characters.card.generateLookSheets", { count: n, look: lookName(look) })}
                  </Button>
                  <span className={cn("text-sm", sendsFace ? "text-muted-foreground" : "text-warning")}>
                    {sendsFace ? t("characters.card.faceAlwaysSent") : c.face_ref ? t("characters.card.lookNoFace") : t("characters.card.noFacePhoto")}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardSection>
      </CardContent>
      {open !== null && (
        <Lightbox
          title={t("characters.card.lightboxTitle", { name: c.display_name || c.name })}
          images={images}
          approved={approved}
          start={open}
          onApprove={(name) => toggle.mutate(name)}
          onDiscard={(name) => discard.mutate(name)}
          caption={(name) => sheetLabel(name) + (c.sheet_names[name] ? ` (${name})` : "")}
          extra={(name) => (
            <>
              <SheetName key={name} c={c} file={name} />
              {name !== c.face_ref && (
                <Button variant="outline" size="sm" disabled={name === reference || pin.isPending} onClick={() => pin.mutate(name)}
                  title={t("characters.card.pinTitle")}>
                  <PinIcon /> {name === reference ? t("characters.card.pinned", { look: lookName(look) }) : t("characters.card.pin", { look: lookName(look) })}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setFace.mutate(name)} title={t("characters.card.faceRefTitle")}>
                <ScanFaceIcon /> {c.face_ref === name ? t("characters.card.faceRefActive") : t("characters.card.useAsFaceRef")}
              </Button>
            </>
          )}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}

/** The tile image for a character: face photo, else the main look's reference, else its first sheet. */
const coverOf = (c: Character) => c.face_ref ?? lookReference(c, DEFAULT_LOOK) ?? c.sheets[0];

/** Characters page: one tile per character (like a folder); each opens its own page. */
export function Characters() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["characters"], queryFn: () => api.get<CharacterList>("/api/characters") });
  const [pending, setPending] = useState<RunRequest | null>(null);
  const [wizard, setWizard] = useState(false);
  const { jobId, setJob } = useScopeJob("characters", (j) => j.kind === "character" || j.kind === "voice_preview");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("characters.title")} description={t("characters.description")}>
        <Button onClick={() => setWizard(true)} disabled={!q.data}><PlusIcon /> {t("characters.new.title")}</Button>
      </PageHeader>
      {jobId && <JobProgress jobId={jobId} invalidate={[["characters"], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {q.data && q.data.characters.length === 0 && <Empty title={t("characters.empty.title")} icon={UsersIcon}>{t("characters.empty.body")}</Empty>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {q.data?.characters.map((c) => {
          const cover = coverOf(c);
          const looks = 1 + Object.keys(c.looks).length;
          return (
            <Link key={c.name} to={`/characters/${c.name}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <div className="aspect-square w-full bg-muted">
                {cover ? <img src={fileUrl("library", "characters", c.name, cover)} alt="" className="size-full object-cover transition group-hover:opacity-90" />
                  : <UsersIcon className="m-auto mt-[40%] size-8 text-muted-foreground" />}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{c.display_name || c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.name}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{t("characters.grid.looks", { count: looks })}</Badge>
                  <Badge variant={c.face_ref ? "success" : "warning"}>{c.face_ref ? t("characters.grid.face") : t("characters.grid.noFace")}</Badge>
                  <Badge variant={c.voice ? "success" : "warning"}>{c.voice ? t("characters.grid.voice") : t("characters.grid.noVoice")}</Badge>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {wizard && q.data && (
        <CharacterWizard styles={q.data} onClose={() => setWizard(false)} onGenerate={setPending}
          onCreated={(name) => navigate(`/characters/${name}`)} />
      )}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}

/** One character's page ("folder"): 1 Face · 2 Voice · 3 Looks. */
export function CharacterPage() {
  const { t } = useTranslation();
  const { name = "" } = useParams();
  const q = useQuery({ queryKey: ["characters"], queryFn: () => api.get<CharacterList>("/api/characters") });
  const [pending, setPending] = useState<RunRequest | null>(null);
  const { jobId, setJob } = useScopeJob("characters", (j) => j.kind === "character" || j.kind === "voice_preview");
  const c = q.data?.characters.find((x) => x.name === name);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={c ? c.display_name || c.name : name} description={t("characters.page.description")}
        crumb={<Link to="/characters" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-3.5" /> {t("characters.title")}</Link>} />
      {jobId && <JobProgress jobId={jobId} invalidate={[["characters"], ["overview"], ["costs"]]} onDismiss={() => setJob(null)} />}
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {q.data && !c && <Empty title={t("characters.page.notFound", { name })} icon={UsersIcon} />}
      {q.data && c && <CharacterCard key={`${c.name}-${c.prompt_block}-${c.display_name}-${c.style}`} c={c} styles={q.data} onGenerate={setPending} />}
      {pending && <SpendModal request={pending} onClose={() => setPending(null)} onStarted={(job) => setJob(job.id)} />}
    </div>
  );
}
