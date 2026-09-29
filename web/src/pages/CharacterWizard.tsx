import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ScanFaceIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, RunRequest, VoiceCatalog } from "../api";
import { CostChip, ErrorBox, StatusMark } from "../components/common";
import { StyleSelect, styleLabel, type Styles } from "./Characters";

const STEPS = ["name", "face", "voice", "outfit", "review"] as const;
type Step = (typeof STEPS)[number];
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/**
 * New character, step by step: name → face (photo or description) → voice → outfit & style → review.
 * Nothing is saved or generated until the last step; "Create & generate" hands one paid run to the spend dialog.
 */
export function CharacterWizard({ styles, onClose, onGenerate, onCreated }: {
  styles: Styles; onClose: () => void; onGenerate: (r: RunRequest) => void; onCreated?: (name: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const voices = useQuery({ queryKey: ["voices"], queryFn: () => api.get<VoiceCatalog>("/api/voices"), staleTime: Infinity });
  const [step, setStep] = useState<Step>("name");
  const [id, setId] = useState("");
  const [display, setDisplay] = useState("");
  const [faceMode, setFaceMode] = useState<"photo" | "describe">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [person, setPerson] = useState("");
  const [lang, setLang] = useState<"mandarin" | "cantonese">("mandarin");
  const [voiceId, setVoiceId] = useState("");
  const [style, setStyle] = useState(styles.styles.includes("realistic") ? "realistic" : styles.default_style);
  const [outfit, setOutfit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const valid: Record<Step, boolean> = {
    name: ID_RE.test(id),
    face: faceMode === "photo" ? !!file && consent : !!person.trim(),
    voice: true,
    outfit: true,
    review: true,
  };
  const index = STEPS.indexOf(step);
  const go = (d: number) => setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, index + d))]);
  const options = voices.data?.catalog[lang] ?? [];
  const voiceLabel = options.find((o) => o.id === voiceId)?.label ?? (voiceId || t("characters.wizard.voiceNone"));

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const finish = async (generate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/characters", {
        name: id, display_name: display, prompt_block: person, outfit, style,
        voice: voiceId ? { voice_id: voiceId, speed: 1, pitch: 0, emotion: null } : null,
      });
      if (faceMode === "photo" && file) {
        await api.post(`/api/characters/${id}/photo`, { filename: file.name, data: await readDataUrl(file), consent });
      }
      toast.success(t("characters.new.added", { name: display || id }));
      qc.invalidateQueries({ queryKey: ["characters"] });
      onClose();
      onCreated?.(id);
      if (generate) onGenerate({ kind: "character", name: id, n: 1, face_first: faceMode === "describe" });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = (s: Step) => t(`characters.wizard.steps.${s}`);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("characters.wizard.title")}</DialogTitle>
          <DialogDescription>{t("characters.wizard.description")}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t("characters.wizard.progress")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > index && !STEPS.slice(0, i).every((p) => valid[p])}
                onClick={() => setStep(s)}
                className={cn("flex items-center gap-1.5 disabled:opacity-50", s === step ? "font-semibold" : "text-muted-foreground")}>
                <StatusMark status={i < index ? "done" : s === step ? "progress" : "todo"} />
                {i + 1}. {stepTitle(s)}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex min-h-64 flex-col gap-3">
          {step === "name" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wz-id">{t("characters.new.id")}</Label>
                <Input id="wz-id" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} autoFocus
                  placeholder="laoli" // i18n-ignore: example id (data)
                />
                <p className="text-xs text-muted-foreground">{t("characters.wizard.idHint")}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wz-dn">{t("characters.new.displayName")}</Label>
                <Input id="wz-dn" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="老李" />
              </div>
            </div>
          )}

          {step === "face" && (
            <>
              <Tabs value={faceMode} onValueChange={(v) => setFaceMode(v as "photo" | "describe")}>
                <TabsList>
                  <TabsTrigger value="photo"><UploadIcon /> {t("characters.wizard.facePhoto")}</TabsTrigger>
                  <TabsTrigger value="describe"><ScanFaceIcon /> {t("characters.wizard.faceDescribe")}</TabsTrigger>
                </TabsList>
              </Tabs>
              {faceMode === "photo" ? (
                <div className="flex items-start gap-3">
                  <div className="size-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ScanFaceIcon className="m-auto mt-9 size-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => input.current?.click()}>
                      <UploadIcon /> {file ? t("characters.wizard.photoChange") : t("characters.wizard.photoPick")}
                    </Button>
                    <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                    {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
                    <Label className="text-sm font-normal">
                      <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                      {t("characters.card.photoConsent")}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t("characters.wizard.photoHint")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("characters.wizard.describeHint")}</p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wz-person">{t("characters.card.person")}</Label>
                <Textarea id="wz-person" rows={3} value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t("characters.new.lookPlaceholder")} />
              </div>
            </>
          )}

          {step === "voice" && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("characters.voice.language")}</Label>
                  <Select value={lang} onValueChange={(v) => { setLang(v as "mandarin" | "cantonese"); setVoiceId(""); }}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mandarin">{t("characters.languages.mandarin")}</SelectItem>
                      <SelectItem value="cantonese">{t("characters.languages.cantonese")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("characters.voice.voice")}</Label>
                  <Select value={voiceId || "__none"} onValueChange={(v) => setVoiceId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="w-64"><SelectValue placeholder={t("characters.voice.pick")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("characters.voice.none")}</SelectItem>
                      {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("characters.wizard.voiceHint")}</p>
              <Button type="button" variant="outline" size="sm" className="w-fit" disabled title={t("characters.wizard.voiceUploadSoon")}>
                <UploadIcon /> {t("characters.wizard.voiceUpload")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("characters.wizard.voiceUploadSoon")}</p>
            </>
          )}

          {step === "outfit" && (
            <>
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="wz-style">{t("characters.new.style")}</Label>
                <StyleSelect id="wz-style" value={style} onChange={setStyle} styles={styles} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wz-outfit">{t("characters.new.outfit")}</Label>
                <Textarea id="wz-outfit" rows={3} value={outfit} onChange={(e) => setOutfit(e.target.value)} placeholder={t("characters.new.outfitPlaceholder")} />
                <p className="text-xs text-muted-foreground">{t("characters.wizard.outfitHint")}</p>
              </div>
            </>
          )}

          {step === "review" && (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("characters.wizard.steps.name")}</dt>
              <dd>{display || id} <span className="font-mono text-xs text-muted-foreground">{id}</span></dd>
              <dt className="text-muted-foreground">{t("characters.wizard.steps.face")}</dt>
              <dd className="flex items-start gap-2">
                {faceMode === "photo" && preview && <img src={preview} alt="" className="size-10 rounded object-cover" />}
                <span>{faceMode === "photo" ? t("characters.wizard.reviewPhoto", { name: file?.name ?? "" }) : t("characters.wizard.reviewDescribed")}
                  {person && <span className="block text-muted-foreground">{person}</span>}</span>
              </dd>
              <dt className="text-muted-foreground">{t("characters.wizard.steps.voice")}</dt>
              <dd>{voiceLabel}</dd>
              <dt className="text-muted-foreground">{t("characters.wizard.steps.outfit")}</dt>
              <dd>{styleLabel(t, style)}{outfit && <span className="block text-muted-foreground">{outfit}</span>}</dd>
              <dt className="text-muted-foreground">{t("characters.wizard.generates")}</dt>
              <dd>{faceMode === "photo" ? t("characters.wizard.generatesPhoto") : t("characters.wizard.generatesDescribed")}</dd>
            </dl>
          )}
          <ErrorBox error={error} />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={index === 0 || busy} onClick={() => go(-1)}><ArrowLeftIcon /> {t("characters.wizard.back")}</Button>
          {step !== "review" ? (
            <Button disabled={!valid[step]} onClick={() => go(1)}>{t("characters.wizard.next")} <ArrowRightIcon /></Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => finish(false)}><CheckIcon /> {t("characters.wizard.createOnly")}</Button>
              <Button variant="spend" disabled={busy} onClick={() => finish(true)}>
                <SparklesIcon /> {t("characters.wizard.createGenerate")} <CostChip>{faceMode === "photo" ? "≈ $0.03" : "≈ $0.06"}</CostChip>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
