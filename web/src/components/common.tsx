import { CheckIcon, CopyIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_ORDER } from "../format";

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading">
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

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <div className="font-medium">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-warning", in_progress: "bg-warning", estimated: "bg-warning",
  approved: "bg-success", done: "bg-success",
};

export function StageDot({ status }: { status?: string }) {
  return <span className={cn("inline-block size-1.5 rounded-full bg-border", status && STATUS_COLOR[status])} title={status} />;
}

export function Stepper({ stages }: { stages: Record<string, string> }) {
  return (
    <div className="flex gap-1" aria-label="Stage progress">
      {STAGE_ORDER.map((s) => (
        <span key={s} className={cn("h-1.5 flex-1 rounded-full bg-border", STATUS_COLOR[stages[s] ?? ""])} title={`${s}: ${stages[s] ?? "todo"}`} />
      ))}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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
        toast.success("Copied — paste it into Claude Code");
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />} {label}
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
