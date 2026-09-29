import { CheckIcon, CopyIcon, InboxIcon, type LucideIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_ORDER } from "../format";

export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
    </Alert>
  );
}

/** Empty state: what's missing and the next step (DESIGN.md). */
export function Empty({ title, children, icon: Icon = InboxIcon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <Icon className="size-6 text-primary-mark" aria-hidden />
        <div className="font-medium">{title}</div>
        <div className="max-w-prose text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

/** One status scheme for every stage: colour AND shape, so it also reads without colour (DESIGN.md). */
export type Status = "todo" | "progress" | "done" | "attention";
const STATUS_OF: Record<string, Status> = {
  draft: "progress", in_progress: "progress", estimated: "progress",
  agreed: "done", approved: "done", tts: "done", done: "done",
  failed: "attention", error: "attention",
};
export const statusOf = (raw?: string): Status => (raw && STATUS_OF[raw]) || "todo";

export function StatusMark({ status, className }: { status: Status; className?: string }) {
  const { t } = useTranslation();
  const base = "inline-flex size-2.5 shrink-0 items-center justify-center rounded-full";
  const look: Record<Status, string> = {
    todo: "border-[1.5px] border-status-todo",
    progress: "border-[1.5px] border-status-progress bg-[linear-gradient(90deg,var(--status-progress)_50%,transparent_50%)]",
    done: "bg-status-done",
    attention: "size-3 bg-status-attention text-[8px] font-bold leading-none text-white",
  };
  return (
    <span className={cn(base, look[status], className)} role="img" aria-label={t(`common.status.${status}`)} title={t(`common.status.${status}`)}>
      {status === "attention" ? "!" : null}
    </span>
  );
}

export function StageDot({ status }: { status?: string }) {
  return <StatusMark status={statusOf(status)} />;
}

export function Stepper({ stages }: { stages: Record<string, string> }) {
  const { t } = useTranslation();
  const color: Record<Status, string> = { todo: "bg-border", progress: "bg-status-progress", done: "bg-status-done", attention: "bg-status-attention" };
  return (
    <div className="flex gap-1" aria-label={t("common.stageProgress")}>
      {STAGE_ORDER.map((s) => {
        const st = statusOf(stages[s]);
        return <span key={s} className={cn("h-1.5 flex-1 rounded-full", color[st])} title={`${t(`common.stages.${s}`)}: ${t(`common.status.${st}`)}`} />;
      })}
    </div>
  );
}

/** Cost next to a paid action's label, e.g. <Button variant="spend">Generate <CostChip usd={0.03} /></Button>. */
export function CostChip({ children }: { children: ReactNode }) {
  return <span className="rounded bg-spend-foreground/15 px-1.5 font-mono text-[0.75rem] tabular-nums">{children}</span>;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        toast.success(t("common.copiedToast"));
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />} {label ?? t("common.actions.copy")}
    </Button>
  );
}

export function PageHeader({ title, description, children, crumb }: { title: ReactNode; description?: ReactNode; children?: ReactNode; crumb?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumb && <div className="mb-1 text-xs text-muted-foreground">{crumb}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
