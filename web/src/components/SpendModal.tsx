import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, Estimate, Job, RunRequest } from "../api";
import { useMoney } from "../format";
import { ErrorBox, Loading } from "./common";

/** Itemised estimate + budget guard. Nothing is spent until "Spend" is clicked. */
export function SpendModal({ request, onClose, onStarted }: {
  request: RunRequest;
  onClose: () => void;
  onStarted: (job: Job) => void;
}) {
  const money = useMoney();
  const est = useQuery({
    queryKey: ["estimate", request],
    queryFn: () => api.post<Estimate>("/api/estimate", request),
    gcTime: 0,
  });
  const start = useMutation({
    mutationFn: () => api.post<Job>("/api/jobs", request),
    onSuccess: (job) => {
      toast.info(`Generation started — est. ${money(job.estimate)}`);
      onStarted(job);
      onClose();
    },
  });
  const e = est.data;
  const blocked = !!e?.blocked_reason || (e && !e.has_fal_key);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm spend</DialogTitle>
          <DialogDescription>Estimated from config/prices.yaml. Nothing is sent until you confirm.</DialogDescription>
        </DialogHeader>
        {est.isLoading && <Loading rows={2} />}
        <ErrorBox error={est.error} />
        {e && (
          <div className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Model endpoint</TableHead>
                  <TableHead className="num">Units</TableHead>
                  <TableHead className="num">Unit price</TableHead>
                  <TableHead className="num">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.items.map((i) => (
                  <TableRow key={i.label}>
                    <TableCell>{i.label}</TableCell>
                    <TableCell className="font-mono text-xs">{i.endpoint}</TableCell>
                    <TableCell className="num">{i.units} {i.unit}</TableCell>
                    <TableCell className="num">{money(i.unit_price, 4)}</TableCell>
                    <TableCell className="num">{money(i.cost, 3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total (estimate)</TableCell>
                  <TableCell className="num">{money(e.total, 3)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="text-xs text-muted-foreground">
              Month to date {money(e.month_spent)} of {money(e.monthly_budget)} · per-run cap {money(e.max_per_run)}
            </div>
            {[...e.notes, ...e.warnings].map((n) => (
              <Alert key={n} variant="warning"><AlertDescription>{n}</AlertDescription></Alert>
            ))}
            {e.blocked_reason && <Alert variant="destructive"><AlertDescription>Blocked: {e.blocked_reason}</AlertDescription></Alert>}
            {!e.has_fal_key && (
              <Alert variant="destructive"><AlertDescription>FAL_KEY is not set in .env — add it, then restart the app.</AlertDescription></Alert>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Prompts that will be sent ({e.requests.length})</summary>
              <div className="mt-2 flex flex-col gap-2">
                {e.requests.map((r) => (
                  <div key={r.label}>
                    <div className="text-xs"><strong>{r.label}</strong> · {r.model} · {r.references} reference image(s)</div>
                    <div className="prompt-block">{r.prompt}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
        <ErrorBox error={start.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!e || blocked || start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? "Starting…" : e ? `Spend ≈ ${money(e.total)}` : "Spend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
