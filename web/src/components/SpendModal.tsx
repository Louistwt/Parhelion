import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, Estimate, Job, RunRequest } from "../api";
import { useMoney } from "../format";
import { CostChip, ErrorBox, Loading } from "./common";

/** Itemised estimate + budget guard. Nothing is spent until "Spend" is clicked. */
export function SpendModal({ request, onClose, onStarted }: {
  request: RunRequest;
  onClose: () => void;
  onStarted: (job: Job) => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const est = useQuery({
    queryKey: ["estimate", request],
    queryFn: () => api.post<Estimate>("/api/estimate", request),
    gcTime: 0,
  });
  const start = useMutation({
    mutationFn: () => api.post<Job>("/api/jobs", request),
    onSuccess: (job) => {
      toast.info(t("panels.spend.startedToast", { cost: money(job.estimate) }));
      onStarted(job);
      onClose();
    },
  });
  const e = est.data;
  const blocked = !!e?.blocked_reason || (e && !e.has_fal_key);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("panels.spend.title")}</DialogTitle>
          <DialogDescription>{t("panels.spend.description")}</DialogDescription>
        </DialogHeader>
        {est.isLoading && <Loading rows={2} />}
        <ErrorBox error={est.error} />
        {e && (
          // min-w-0: a grid child would otherwise grow to the table's width and push past the dialog
          <div className="flex min-w-0 flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("panels.spend.cols.request")}</TableHead>
                  <TableHead>{t("panels.spend.cols.endpoint")}</TableHead>
                  <TableHead className="num">{t("panels.spend.cols.units")}</TableHead>
                  <TableHead className="num">{t("panels.spend.cols.unitPrice")}</TableHead>
                  <TableHead className="num">{t("panels.spend.cols.cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.items.map((i) => (
                  <TableRow key={i.label}>
                    <TableCell>{i.label}</TableCell>
                    <TableCell className="max-w-56 font-mono text-xs break-all whitespace-normal">{i.endpoint}</TableCell>
                    <TableCell className="num">{i.units} {i.unit}</TableCell>
                    <TableCell className="num">{money(i.unit_price, 4)}</TableCell>
                    <TableCell className="num">{money(i.cost, 3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>{t("panels.spend.total")}</TableCell>
                  <TableCell className="num">{money(e.total, 3)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="text-xs text-muted-foreground">
              {t("panels.spend.budget", { spent: money(e.month_spent), budget: money(e.monthly_budget), cap: money(e.max_per_run) })}
            </div>
            {[...e.notes, ...e.warnings].map((n) => (
              <Alert key={n} variant="warning"><AlertDescription>{n}</AlertDescription></Alert>
            ))}
            {e.blocked_reason && <Alert variant="destructive"><AlertDescription>{t("panels.spend.blocked", { reason: e.blocked_reason })}</AlertDescription></Alert>}
            {!e.has_fal_key && (
              <Alert variant="destructive"><AlertDescription>{t("panels.spend.noFalKey")}</AlertDescription></Alert>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">{t("panels.spend.prompts", { count: e.requests.length })}</summary>
              <div className="mt-2 flex flex-col gap-2">
                {e.requests.map((r) => (
                  <div key={r.label}>
                    <div className="text-xs"><strong>{r.label}</strong> · {r.model} · {t("panels.spend.references", { count: r.references })}</div>
                    <div className="prompt-block">{r.prompt}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
        <ErrorBox error={start.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.actions.cancel")}</Button>
          <Button variant="spend" disabled={!e || blocked || start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? t("panels.spend.starting") : t("panels.spend.spend")}
            {!start.isPending && e && <CostChip>≈ {money(e.total, e.total < 0.1 ? 3 : 2)}</CostChip>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
