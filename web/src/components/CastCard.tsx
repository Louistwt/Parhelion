import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, CharacterList, fileUrl } from "../api";
import { lookReference, styleLabel } from "../pages/Characters";
import { ErrorBox } from "./common";

const DEFAULT_LOOK = "default";
type CastResp = { cast: Record<string, string>; script_characters: string[] };

/**
 * Who is in this video and which look each wears (project.json `cast`). Keyframes send that look's reference sheet;
 * a single shot can still override it on the Shots tab. Works before a script or shot list exists.
 */
export function CastCard({ id }: { id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cast", id], queryFn: () => api.get<CastResp>(`/api/projects/${id}/cast`) });
  const chars = useQuery({ queryKey: ["characters"], queryFn: () => api.get<CharacterList>("/api/characters") });
  const save = useMutation({
    mutationFn: (cast: Record<string, string>) => api.put(`/api/projects/${id}/cast`, { cast }),
    onSuccess: () => {
      toast.success(t("brief.cast.saved"));
      for (const key of [["cast", id], ["shots", id], ["lint", id], ["keyframes", id]]) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(String(e)),
  });
  const cast = q.data?.cast ?? {};
  const inScript = q.data?.script_characters ?? [];
  const names = [...new Set([...Object.keys(cast), ...inScript])];
  const all = chars.data?.characters ?? [];
  const addable = all.filter((c) => !names.includes(c.name));
  const set = (name: string, look: string) => save.mutate({ ...cast, [name]: look });
  const remove = (name: string) => { const { [name]: _gone, ...rest } = cast; save.mutate(rest); };

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UsersIcon className="size-4" /> {t("brief.cast.title")}</CardTitle>
        <CardDescription>{t("brief.cast.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {names.length === 0 && <p className="text-sm text-muted-foreground">{t("brief.cast.empty")}</p>}
        {names.map((name) => {
          const c = all.find((x) => x.name === name);
          const look = cast[name] ?? DEFAULT_LOOK;
          const ref = c ? lookReference(c, look) : undefined;
          const lookLabel = (k: string) => (k === DEFAULT_LOOK ? t("characters.card.lookDefault") : c?.looks[k]?.label || k);
          const style = c ? (look === DEFAULT_LOOK ? c.style : c.looks[look]?.style || c.style) : null;
          return (
            <div key={name} className="flex items-center gap-3 rounded-lg border p-2">
              <Link to={`/characters/${name}`} className="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted" title={t("brief.cast.open")}>
                {ref && <img src={fileUrl("library", "characters", name, ref)} alt="" className="size-full object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c?.display_name || name}</span>
                  {!cast[name] && <Badge variant="warning">{t("brief.cast.notSet")}</Badge>}
                  {style && <Badge variant="outline">{styleLabel(t, style)}</Badge>}
                </div>
                {c ? (
                  <Select value={look} onValueChange={(v) => set(name, v)}>
                    <SelectTrigger size="sm" className="w-full" aria-label={t("brief.cast.lookFor", { name: c.display_name || name })}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[DEFAULT_LOOK, ...Object.keys(c.looks)].map((k) => <SelectItem key={k} value={k}>{lookLabel(k)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <span className="text-xs text-destructive">{t("brief.cast.missing")}</span>}
                {c && !ref && <span className="text-xs text-warning">{t("brief.cast.noReference")}</span>}
                {ref && <span className="truncate text-xs text-muted-foreground">{t("brief.cast.reference", { name: c?.sheet_names[ref] || ref })}</span>}
              </div>
              {!inScript.includes(name) && (
                <Button variant="ghost" size="icon-sm" aria-label={t("brief.cast.remove", { name })} onClick={() => remove(name)}><XIcon /></Button>
              )}
            </div>
          );
        })}
        {addable.length > 0 && (
          <Select value="" onValueChange={(v) => set(v, DEFAULT_LOOK)}>
            <SelectTrigger size="sm" className="w-full"><SelectValue placeholder={t("brief.cast.add")} /></SelectTrigger>
            <SelectContent>{addable.map((c) => <SelectItem key={c.name} value={c.name}>{c.display_name || c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <ErrorBox error={q.error} />
      </CardContent>
    </Card>
  );
}
