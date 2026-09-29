import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Thumbnail button: 9:16 for keyframes, `wide` (16:9) for character sheets. `mark` adds a second tag (e.g. "reference"). */
export function Thumb({ src, label, approved, onClick, wide, mark }: {
  src: string; label: string; approved?: boolean; onClick?: () => void; wide?: boolean; mark?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "relative block w-full overflow-hidden rounded-lg border-2 border-transparent bg-muted transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        wide ? "aspect-video" : "aspect-[9/16]",
        approved && "border-success",
      )}
    >
      <img src={src} alt={label} loading="lazy" className="size-full object-cover" />
      <span className={cn("absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded px-1.5 py-px text-[11px] text-white", approved ? "bg-success" : "bg-black/60")}>
        {label}{approved && <CheckIcon className="size-3" />}
      </span>
      {mark && <span className="absolute bottom-1.5 left-1.5 rounded bg-primary px-1.5 py-px text-[11px] font-medium text-primary-foreground">{mark}</span>}
    </button>
  );
}

export function ThumbEmpty({ label, wide }: { label: string; wide?: boolean }) {
  return <div className={cn("flex w-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground", wide ? "aspect-video" : "aspect-[9/16]")}>{label}</div>;
}

export function ThumbGrid({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("grid gap-2.5", wide ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(118px,1fr))]")}>{children}</div>;
}
