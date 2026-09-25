import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TimerIcon } from "lucide-react";
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
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ["timing", id], queryFn: () => api.get<{ timing: Timing | null }>(`/api/projects/${id}/timing`) });
  const s = useQuery({ queryKey: ["script", id], queryFn: () => api.get<{ script: Script | null }>(`/api/projects/${id}/script`) });
  const run = useMutation({
    mutationFn: () => api.post<{ timing: Timing }>(`/api/projects/${id}/timing`),
    onSuccess: (r) => {
      toast.success(`Estimated ${r.timing.total_seconds.toFixed(1)}s`);
      qc.invalidateQueries({ queryKey: ["timing", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const timing = t.data?.timing;
  const script = s.data?.script;
  const over = timing ? timing.total_seconds > target * 1.1 : false;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{timing?.source === "tts" ? "Timing from the voice track" : "Estimated timing"}</CardTitle>
          <CardDescription>
            {timing?.source === "tts"
              ? "Real durations of the approved voice takes. Re-estimating replaces it with a character-count estimate."
              : "From character count. Build the voice track (Voice tab) to replace this with real timing."}
          </CardDescription>
          <CardAction><Button disabled={!script || run.isPending} onClick={() => run.mutate()}><TimerIcon /> {timing ? "Re-estimate" : "Estimate timing"}</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!script && !s.isLoading && <Alert><AlertDescription>Needs script.json first.</AlertDescription></Alert>}
          <ErrorBox error={run.error} />
          {timing && (
            <>
              <div className="flex justify-between text-sm"><span>{timing.total_seconds.toFixed(1)}s at {timing.chars_per_second} chars/s</span><span className="text-muted-foreground">target {target}s</span></div>
              <Progress value={Math.min(100, (100 * timing.total_seconds) / target)} className={cn(over && "[&>div]:bg-destructive")} />
              {over && <p className="text-sm text-destructive">Over target by more than 10% — shorten lines.</p>}
            </>
          )}
        </CardContent>
      </Card>
      {(t.isLoading || s.isLoading) && <Loading />}
      {timing && script && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Line</TableHead><TableHead>Text</TableHead><TableHead className="num">Chars</TableHead><TableHead className="num">Start</TableHead><TableHead className="num">End</TableHead><TableHead className="w-[30%]">Position</TableHead></TableRow></TableHeader>
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
                          <div className="absolute inset-y-0 rounded bg-primary" style={{ left: `${left}%`, width: `${width}%` }} />
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
