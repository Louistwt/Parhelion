import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../api";
import { ErrorBox, Loading } from "../../components/common";

export function BriefTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brief", id], queryFn: () => api.get<{ text: string }>(`/api/projects/${id}/brief`) });
  const [text, setText] = useState("");
  useEffect(() => { if (q.data) setText(q.data.text); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put(`/api/projects/${id}/brief`, { text }),
    onSuccess: () => {
      toast.success(t("brief.saved"));
      qc.invalidateQueries({ queryKey: ["brief", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const dirty = q.data !== undefined && text !== q.data.text;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{"brief.md"}</CardTitle>
          <CardAction className="flex items-center gap-2">
            {dirty && <Badge variant="warning">{t("common.unsaved")}</Badge>}
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> {t("common.actions.save")}</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {q.isLoading ? <Loading rows={6} /> : (
            <Textarea
              className="min-h-[480px] font-[inherit] text-[15px] leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (dirty) save.mutate(); } }}
            />
          )}
          <ErrorBox error={save.error} />
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader><CardTitle>{t("brief.guide.title")}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{t("brief.guide.intro")}</p>
          <ul className="list-disc pl-5">
            <li>{t("brief.guide.format")}</li>
            <li>{t("brief.guide.characters")}</li>
            <li>{t("brief.guide.keyPoint")}</li>
            <li>{t("brief.guide.beats")}</li>
            <li>{t("brief.guide.avoid")}</li>
          </ul>
          <p><Trans i18nKey="brief.guide.history" components={{ code: <code />, kbd: <kbd className="kbd" /> }} /></p>
        </CardContent>
      </Card>
    </div>
  );
}
