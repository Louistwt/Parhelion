import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, LayoutGridIcon } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, fileUrl } from "../../api";
import { Empty, ErrorBox, Loading } from "../../components/common";

export function StoryboardTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["storyboards", id], queryFn: () => api.get<{ storyboards: string[] }>(`/api/projects/${id}/storyboards`) });
  const [sel, setSel] = useState<string | null>(null);
  const render = useMutation({
    mutationFn: () => api.post<{ file: string }>(`/api/projects/${id}/storyboards`),
    onSuccess: (r) => {
      toast.success(t("storyboard.rendered", { file: r.file }));
      setSel(r.file);
      qc.invalidateQueries({ queryKey: ["storyboards", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const list = q.data?.storyboards ?? [];
  const current = sel ?? list[0] ?? null;
  const url = current ? fileUrl("projects", id, "output", current) : null;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("common.stages.storyboard")}</CardTitle>
          <CardDescription>{t("storyboard.description")}</CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            {list.length > 0 && current && (
              <Select value={current} onValueChange={setSel}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{list.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {url && <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLinkIcon /> {t("storyboard.open")}</a></Button>}
            <Button disabled={render.isPending} onClick={() => render.mutate()}><LayoutGridIcon /> {render.isPending ? t("storyboard.rendering") : t("storyboard.render")}</Button>
          </CardAction>
        </CardHeader>
      </Card>
      <ErrorBox error={render.error} />
      {q.isLoading && <Loading />}
      {!q.isLoading && !url && <Empty title={t("storyboard.emptyTitle")} icon={LayoutGridIcon}>{t("storyboard.emptyBody")}</Empty>}
      {url && <iframe className="h-[75vh] w-full rounded-xl border bg-white" src={url} title={t("storyboard.frameTitle", { file: current ?? "" })} />}
      {url && (
        <p className="text-xs text-muted-foreground">
          <Trans i18nKey="storyboard.pdfHelp" components={{ kbd: <kbd className="kbd" /> }} />
        </p>
      )}
    </div>
  );
}
