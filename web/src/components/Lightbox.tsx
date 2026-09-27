import { CheckIcon, Columns3Icon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Kbd } from "./common";

/** Full-screen compare view. ←/→ move focus, Enter approves, Esc closes. Optional Discard hides an unwanted image. */
export function Lightbox({ title, images, approved, start = 0, onApprove, onDiscard, onClose }: {
  title: string;
  images: { src: string; name: string }[];
  approved: string[];
  start?: number;
  onApprove: (name: string) => void;
  onDiscard?: (name: string) => void;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState(start);
  const [compare, setCompare] = useState(images.length <= 3);

  // the list shrinks after a discard
  useEffect(() => {
    if (images.length === 0) onClose();
    else if (focus > images.length - 1) setFocus(images.length - 1);
  }, [images.length, focus, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setFocus((f) => Math.min(images.length - 1, f + 1));
      else if (e.key === "ArrowLeft") setFocus((f) => Math.max(0, f - 1));
      else if (e.key === "Enter" && images[focus]) onApprove(images[focus].name);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, images, onApprove, onClose]);

  const shown = compare ? images.map((im, i) => ({ ...im, i })) : images[focus] ? [{ ...images[focus], i: focus }] : [];
  const current = images[focus];
  return (
    <div className="dark fixed inset-0 z-50 flex flex-col bg-black/90 text-foreground" role="dialog" aria-modal="true">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-medium">{title}</span>
          <span className="hidden text-xs text-muted-foreground md:inline">
            <Kbd>←</Kbd> <Kbd>→</Kbd> browse · <Kbd>Enter</Kbd> approve · <Kbd>Esc</Kbd> close
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCompare((c) => !c)}>
            {compare ? <SquareIcon /> : <Columns3Icon />} {compare ? "Single view" : "Compare all"}
          </Button>
          {current && onDiscard && (
            <Button variant="outline" size="sm" disabled={approved.includes(current.name)}
              title={approved.includes(current.name) ? "Unapprove it first" : "Hide this image (moved to discarded/, not deleted)"}
              onClick={() => { if (window.confirm(`Discard ${current.name}? It moves to the discarded/ folder and disappears from here.`)) onDiscard(current.name); }}>
              <Trash2Icon /> Discard
            </Button>
          )}
          {current && (
            <Button size="sm" onClick={() => onApprove(current.name)}>
              <CheckIcon /> {approved.includes(current.name) ? "Approved" : `Approve ${current.name.replace(/\.\w+$/, "")}`}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><XIcon /></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-4 pb-4">
        {shown.map((im) => (
          <figure key={im.name} className="m-0 flex h-full min-w-0 flex-col items-center gap-1.5">
            <img
              src={im.src}
              alt={im.name}
              onClick={() => setFocus(im.i)}
              className={cn(
                "max-h-[calc(100%-1.75rem)] max-w-full cursor-pointer rounded-md border-[3px] border-transparent",
                approved.includes(im.name) && "border-success",
                compare && im.i === focus && "ring-2 ring-primary ring-offset-2 ring-offset-black",
              )}
            />
            <figcaption className="text-xs text-muted-foreground">{im.name}{approved.includes(im.name) ? " · approved" : ""}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
