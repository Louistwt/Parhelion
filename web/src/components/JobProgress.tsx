import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api, Job } from "../api";
import { useMoney } from "../format";

const FINAL = ["done", "failed", "blocked"];

/** Polls a job every 2 s until it finishes, refreshing the given queries as files arrive. */
export function JobProgress({ jobId, invalidate, onDismiss }: { jobId: string; invalidate: unknown[][]; onDismiss: () => void }) {
  const qc = useQueryClient();
  const money = useMoney();
  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.get<Job>(`/api/jobs/${jobId}`),
    refetchInterval: (q) => (q.state.data && FINAL.includes(q.state.data.status) ? false : 2000),
  });
  const finished = !!job && FINAL.includes(job.status);
  const savedCount = job ? job.events.filter((e) => e.event === "saved").length : 0;
  const announced = useRef(false);

  useEffect(() => {
    invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCount, finished]);

  useEffect(() => {
    if (!job || !finished || announced.current) return;
    announced.current = true;
    const failed = job.events.filter((e) => e.event === "failed").length;
    if (job.status === "done" && !failed) toast.success(`Generation finished: ${savedCount} request(s) saved`);
    else if (job.status === "done") toast.warning(`Finished with ${failed} failed request(s) — completed images were kept`);
    else toast.error(`Job ${job.status}: ${job.error ?? "see log"}`);
  }, [finished, job, savedCount]);

  if (!job) return null;
  const pct = job.progress.total ? (100 * job.progress.done) / job.progress.total : 0;
  const variant = job.status === "done" ? "success" : job.status === "running" || job.status === "queued" ? "default" : "destructive";
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Generation job</span>
            <Badge variant={variant}>{job.status}</Badge>
            <span className="text-xs text-muted-foreground">{job.progress.done}/{job.progress.total} requests · est. {money(job.estimate)}</span>
          </div>
          {finished && <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>}
        </div>
        <Progress value={pct} />
        {job.error && <Alert variant="destructive"><AlertDescription>{job.error}</AlertDescription></Alert>}
        {job.events.length > 0 && (
          <ScrollArea className="h-36 rounded-md bg-muted p-2">
            <div className="font-mono text-xs">
              {job.events.map((e, i) => (
                <div key={i} className={cn(e.event === "failed" && "text-destructive", e.event === "saved" && "text-success")}>{e.message}</div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
