import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, LayoutGridIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, fileUrl } from "../../api";
import { Empty, ErrorBox, Kbd, Loading } from "../../components/common";

export function StoryboardTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["storyboards", id], queryFn: () => api.get<{ storyboards: string[] }>(`/api/projects/${id}/storyboards`) });
  const [sel, setSel] = useState<string | null>(null);
  const render = useMutation({
    mutationFn: () => api.post<{ file: string }>(`/api/projects/${id}/storyboards`),
    onSuccess: (r) => {
      toast.success(`Rendered ${r.file}`);
      setSel(r.file);
      qc.invalidateQueries({ queryKey: ["storyboards", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const list = q.data?.storyboards ?? [];
  const current = sel ?? list[0] ?? null;
  const url = current ? fileUrl("projects", id, "output", current) : null;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Storyboard</CardTitle>
          <CardDescription>Approved keyframes + line text + timing on one page. Shots without an approved keyframe show the latest variant, marked "not approved".</CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            {list.length > 0 && current && (
              <Select value={current} onValueChange={setSel}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{list.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {url && <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Open for print / PDF</a></Button>}
            <Button disabled={render.isPending} onClick={() => render.mutate()}><LayoutGridIcon /> {render.isPending ? "Rendering…" : "Render new version"}</Button>
          </CardAction>
        </CardHeader>
      </Card>
      <ErrorBox error={render.error} />
      {q.isLoading && <Loading />}
      {!q.isLoading && !url && <Empty title="No storyboard rendered yet">Needs script.json and shotlist.json. Rendering is free (no API calls).</Empty>}
      {url && <iframe className="h-[75vh] w-full rounded-xl border bg-white" src={url} title={current ?? "storyboard"} />}
      {url && <p className="text-xs text-muted-foreground">To make a PDF: open it, press <Kbd>Ctrl</Kbd>+<Kbd>P</Kbd>, then choose "Save as PDF" (A4 landscape).</p>}
    </div>
  );
}
