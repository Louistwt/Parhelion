import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../api";
import { ErrorBox, Kbd, Loading } from "../../components/common";

export function BriefTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brief", id], queryFn: () => api.get<{ text: string }>(`/api/projects/${id}/brief`) });
  const [text, setText] = useState("");
  useEffect(() => { if (q.data) setText(q.data.text); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put(`/api/projects/${id}/brief`, { text }),
    onSuccess: () => {
      toast.success("Brief saved (previous version kept in .history/)");
      qc.invalidateQueries({ queryKey: ["brief", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
  const dirty = q.data !== undefined && text !== q.data.text;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>brief.md</CardTitle>
          <CardAction className="flex items-center gap-2">
            {dirty && <Badge variant="warning">unsaved</Badge>}
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}><SaveIcon /> Save</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {q.isLoading ? <Loading rows={6} /> : (
            <Textarea
              className="min-h-[480px] font-[inherit] text-[15px] leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (dirty) save.mutate(); } }}
            />
          )}
          <ErrorBox error={save.error} />
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader><CardTitle>What goes here</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>The brief is written by humans. Claude reads it to propose an outline but never changes it.</p>
          <ul className="list-disc pl-5">
            <li>Format and tone (humour optional)</li>
            <li>Characters (from the Characters page)</li>
            <li>The key point from your partner, with sources</li>
            <li>The beats you want, in order</li>
            <li>Anything to avoid</li>
          </ul>
          <p>Each save keeps the previous version in <code>.history/</code>. <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> saves.</p>
        </CardContent>
      </Card>
    </div>
  );
}
