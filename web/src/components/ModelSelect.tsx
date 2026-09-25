import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "../format";

const DEFAULT = "__default";

type Kind = "image" | "tts" | "video" | "lipsync";

/** Model picker for a stage. "" means "config default" (first entry in config/models.yaml). */
export function ModelSelect({ value, onChange, id = "model", kind = "image", label = "Model" }: {
  value: string; onChange: (v: string) => void; id?: string; kind?: Kind; label?: string;
}) {
  const settings = useSettings();
  const s = settings.data;
  const models: { key: string; verified: string | null }[] =
    kind === "image" ? s?.models ?? [] : kind === "tts" ? s?.tts_models ?? [] : kind === "video" ? s?.video_models ?? [] : s?.lipsync_models ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? "" : v)}>
        <SelectTrigger id={id} className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          {models.map((m, i) => (
            <SelectItem key={m.key} value={i === 0 ? DEFAULT : m.key}>
              {m.key}{i === 0 ? " (default)" : ""}{m.verified ? "" : " ⚠ unverified"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
