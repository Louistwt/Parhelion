import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TimerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api, Script, Timing } from "../../api";
import { ErrorBox, Loading } from "../../components/common";

export function TimingTab({ id, target }: { id: string; target: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tq = useQuery({ queryKey: ["timing", id], queryFn: () => api.get<{ timing: Timing | null }>(`/api/projects/${id}/timing`) });
  const s = useQuery({ queryKey: ["script", id], queryFn: () => api.get<{ script: Script | null }>(`/api/projects/${id}/script`) });
  const run = useMutation({
    mutationFn: () => api.post<{ timing: Timing }>(`/api/projects/${id}/timing`),
    onSuccess: (r) => {
      toast.success(t("timing.estimated", { seconds: r.timing.total_seconds.toFixed(1) }));
      qc.invalidateQueries({ queryKey: ["timing", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const timing = tq.data?.timing;
  const script = s.data?.script;
  const over = timing ? timing.total_seconds > target * 1.1 : false;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{timing?.source === "tts" ? t("timing.titleTts") : t("timing.titleEstimate")}</CardTitle>
          <CardDescription>{timing?.source === "tts" ? t("timing.descTts") : t("timing.descEstimate")}</CardDescription>
          <CardAction>
            {timing?.source === "tts"
              ? <span className="text-sm text-muted-foreground">{t("timing.realNote")}</span>
              : <Button disabled={!script || run.isPending} onClick={() => run.mutate()}><TimerIcon /> {timing ? t("timing.reestimate") : t("timing.estimate")}</Button>}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!script && !s.isLoading && <Alert><AlertDescription>{t("timing.needsScript")}</AlertDescription></Alert>}
          <ErrorBox error={run.error} />
          {timing && (
            <>
              <div className="flex justify-between text-sm">
                <span>{t("timing.summary", { seconds: timing.total_seconds.toFixed(1), rate: timing.chars_per_second })}</span>
                <span className="text-muted-foreground">{t("timing.target", { seconds: target })}</span>
              </div>
              <Progress value={Math.min(100, (100 * timing.total_seconds) / target)} className={cn(over && "[&>div]:bg-destructive")} />
              {over && <p className="text-sm text-destructive">{t("timing.over")}</p>}
            </>
          )}
        </CardContent>
      </Card>
      {(tq.isLoading || s.isLoading) && <Loading />}
      {timing && script && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("timing.headers.line")}</TableHead>
                  <TableHead>{t("timing.headers.text")}</TableHead>
                  <TableHead className="num">{t("timing.headers.chars")}</TableHead>
                  <TableHead className="num">{t("timing.headers.start")}</TableHead>
                  <TableHead className="num">{t("timing.headers.end")}</TableHead>
                  <TableHead className="w-[30%]">{t("timing.headers.position")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timing.lines.map((l) => {
                  const line = script.lines.find((x) => x.id === l.line_id);
                  const left = (100 * l.start) / timing.total_seconds;
                  const width = (100 * (l.end - l.start)) / timing.total_seconds;
                  return (
                    <TableRow key={l.line_id}>
                      <TableCell className="font-mono text-xs">{l.line_id}</TableCell>
                      <TableCell className="whitespace-normal">{line?.text_voice}</TableCell>
                      <TableCell className="num">{l.chars}</TableCell>
                      <TableCell className="num">{l.start.toFixed(1)}</TableCell>
                      <TableCell className="num">{l.end.toFixed(1)}</TableCell>
                      <TableCell>
                        <div className="relative h-2.5 rounded bg-muted">
                          <div className="absolute inset-y-0 rounded bg-primary-mark" style={{ left: `${left}%`, width: `${width}%` }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
