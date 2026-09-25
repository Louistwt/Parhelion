import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 9:16 thumbnail button used for keyframe variants and character sheets. */
export function Thumb({ src, label, approved, onClick }: { src: string; label: string; approved?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "relative block aspect-[9/16] w-full overflow-hidden rounded-lg border-2 border-transparent bg-muted transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        approved && "border-success",
      )}
    >
      <img src={src} alt={label} loading="lazy" className="size-full object-cover" />
      <span className={cn("absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded px-1.5 py-px text-[11px] text-white", approved ? "bg-success" : "bg-black/60")}>
        {label}{approved && <CheckIcon className="size-3" />}
      </span>
    </button>
  );
}

export function ThumbEmpty({ label }: { label: string }) {
  return <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">{label}</div>;
}

export function ThumbGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2.5">{children}</div>;
}
