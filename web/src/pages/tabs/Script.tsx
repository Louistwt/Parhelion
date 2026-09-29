import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, FileJsonIcon, FilePenLineIcon, MessageSquareIcon, RefreshCwIcon, SaveIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, Claim, Draft, Script } from "../../api";
import { CopyButton, Empty, ErrorBox, Loading } from "../../components/common";
import { LintPanel } from "../../components/LintPanel";
import { when } from "../../format";

type DraftList = { drafts: Draft[]; claude_prompt: string };
type DraftBody = { version: number; text: string; feedback: string };

/** The prompt comes from the API and stays in English (it is read by Claude Code, not shown as UI). */
function ClaudeHandoff({ prompt }: { prompt: string }) {
  const { t } = useTranslation();
  const note = t("script.handoff.languageNote");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("script.handoff.title")}</CardTitle>
        <CardDescription>{t("script.handoff.description")}{note && <> {note}</>}</CardDescription>
        <CardAction><CopyButton text={prompt} label={t("script.handoff.copy")} /></CardAction>
      </CardHeader>
      <CardContent><div className="prompt-block" lang="en">{prompt}</div></CardContent>
    </Card>
  );
}

function DraftEditor({ id, version, latest }: { id: string; version: number; latest: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["draft", id, version], queryFn: () => api.get<DraftBody>(`/api/projects/${id}/drafts/${version}`) });
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (q.data) {
      setText(q.data.text);
      setFeedback(q.data.feedback);
    }
  }, [q.data]);
  const refresh = () => {
    ["drafts", "draft", "lint", "project"].forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));
  };
  const saveDraft = useMutation({
    mutationFn: () => api.post<{ version: number }>(`/api/projects/${id}/drafts`, { text, based_on: version }),
    onSuccess: (r) => { toast.success(t("script.draft.saved", { file: `script_v${r.version}.md` })); refresh(); },
  });
  const saveFb = useMutation({
    mutationFn: () => api.put(`/api/projects/${id}/drafts/${version}/feedback`, { text: feedback }),
    onSuccess: () => { toast.success(t("script.feedback.saved")); refresh(); },
  });
  if (q.isLoading) return <Loading rows={6} />;
  const dirty = q.data !== undefined && text !== q.data.text;
  const fbDirty = q.data !== undefined && feedback !== q.data.feedback;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{`script_v${version}.md`} {version !== latest && <Badge variant="secondary">{t("script.draft.older")}</Badge>}</CardTitle>
          <CardDescription>{t("script.draft.description")}</CardDescription>
          <CardAction className="flex items-center gap-2">
            {dirty && <Badge variant="warning">{t("common.unsaved")}</Badge>}
            {dirty && <Button variant="ghost" size="sm" onClick={() => setText(q.data!.text)}>{t("script.draft.discardEdits")}</Button>}
            <Button disabled={!dirty || saveDraft.isPending} onClick={() => saveDraft.mutate()}><SaveIcon /> {t("script.draft.saveAs", { n: latest + 1 })}</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea className="min-h-[420px] text-[15px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
          <ErrorBox error={saveDraft.error} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("script.feedback.title", { n: version })}</CardTitle>
          <CardDescription>{t("script.feedback.description", { file: `script_v${version}.feedback.md` })}</CardDescription>
          <CardAction className="flex items-center gap-2">
            {fbDirty && <Badge variant="warning">{t("common.unsaved")}</Badge>}
            <Button variant="outline" disabled={!fbDirty || saveFb.isPending} onClick={() => saveFb.mutate()}><MessageSquareIcon /> {t("script.feedback.save")}</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea rows={5} value={feedback} placeholder={t("script.feedback.placeholder")} onChange={(e) => setFeedback(e.target.value)} />
          <ErrorBox error={saveFb.error} />
        </CardContent>
      </Card>
    </div>
  );
}

const CLAIM_VARIANT = { approved: "success", rejected: "destructive", unverified: "info" } as const;

function ClaimRow({ id, claim }: { id: string; claim: Claim }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [note, setNote] = useState(claim.note);
  const m = useMutation({
    mutationFn: (status: Claim["status"]) => api.post(`/api/projects/${id}/claims/${claim.id}`, { status, note, by: "partner" }),
    onSuccess: (_, status) => {
      toast.success(t("script.claims.toast", { id: claim.id, status: t(`script.claims.status.${status}`) }));
      qc.invalidateQueries({ queryKey: ["script", id] });
      qc.invalidateQueries({ queryKey: ["lint", id] });
    },
  });
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{claim.id}</TableCell>
      <TableCell className="whitespace-normal">{claim.text}<div className="text-xs text-muted-foreground">{t("script.claims.lines", { ids: claim.line_ids.join(", ") })}</div></TableCell>
      <TableCell><Badge variant={CLAIM_VARIANT[claim.status] ?? "info"}>{t(`script.claims.status.${claim.status}`)}</Badge></TableCell>
      <TableCell><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("script.claims.notePlaceholder")} className="min-w-40" /></TableCell>
      <TableCell className="num">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate("approved")}><CheckIcon /> {t("common.actions.approve")}</Button>
          <Button size="sm" variant="destructive" disabled={m.isPending} onClick={() => m.mutate("rejected")}><XIcon /> {t("script.claims.reject")}</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ScriptJson({ id }: { id: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["script", id], queryFn: () => api.get<{ script: Script | null }>(`/api/projects/${id}/script`) });
  const s = q.data?.script;
  if (!s) return <Empty title={t("script.json.emptyTitle")} icon={FileJsonIcon}>{t("script.json.emptyBody")}</Empty>;
  const total = s.lines.reduce((a, l) => a + l.seconds, 0);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("script.json.title", { title: s.title })}</CardTitle>
          <CardDescription>
            {t("script.json.summary", { count: s.lines.length, seconds: total.toFixed(1), target: s.target_seconds })}
            {s.format ? ` · ${s.format}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("script.json.headers.beat")}</TableHead>
                <TableHead>{t("script.json.headers.id")}</TableHead>
                <TableHead>{t("script.json.headers.speaker")}</TableHead>
                <TableHead>{t("script.json.headers.voice")}</TableHead>
                <TableHead>{t("script.json.headers.subtitle")}</TableHead>
                <TableHead className="num">{t("script.json.headers.chars")}</TableHead>
                <TableHead className="num">{t("script.json.headers.seconds")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">{s.beats.find((b) => b.line_ids.includes(l.id))?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.id}</TableCell>
                  <TableCell className="text-xs">{l.speaker}</TableCell>
                  <TableCell className="text-[15px] whitespace-normal">{l.text_voice}</TableCell>
                  <TableCell className="text-xs whitespace-normal text-muted-foreground">{l.text_subtitle && l.text_subtitle !== l.text_voice ? l.text_subtitle : ""}</TableCell>
                  <TableCell className="num">{l.chars}</TableCell>
                  <TableCell className="num">{l.seconds.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("script.claims.title")}</CardTitle>
          <CardDescription>{t("script.claims.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {s.claims.length === 0 ? <p className="text-sm text-muted-foreground">{t("script.claims.none")}</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("script.claims.headers.id")}</TableHead>
                  <TableHead>{t("script.claims.headers.claim")}</TableHead>
                  <TableHead>{t("script.claims.headers.status")}</TableHead>
                  <TableHead>{t("script.claims.headers.note")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>{s.claims.map((c) => <ClaimRow key={`${c.id}-${c.status}`} id={id} claim={c} />)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function ScriptTab({ id }: { id: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["drafts", id], queryFn: () => api.get<DraftList>(`/api/projects/${id}/drafts`) });
  const [selected, setSelected] = useState<number | null>(null);
  const drafts = q.data?.drafts ?? [];
  const latest = drafts.length ? drafts[drafts.length - 1].version : 0;
  const current = selected && drafts.some((d) => d.version === selected) ? selected : latest;
  useEffect(() => { setSelected(null); }, [latest]);

  return (
    <div className="flex flex-col gap-4">
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {q.data && <ClaudeHandoff prompt={q.data.claude_prompt} />}
      {q.data && drafts.length === 0 && (
        <Empty title={t("script.drafts.emptyTitle")} icon={FilePenLineIcon}>{t("script.drafts.emptyBody")}</Empty>
      )}
      {drafts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
          <Card size="sm" className="self-start">
            <CardHeader>
              <CardTitle>{t("script.drafts.title")}</CardTitle>
              <CardAction><Button variant="ghost" size="icon-xs" aria-label={t("script.drafts.refresh")} title={t("script.drafts.refresh")} onClick={() => q.refetch()}><RefreshCwIcon /></Button></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {[...drafts].reverse().map((d) => (
                <Button key={d.version} variant={d.version === current ? "default" : "ghost"} className={cn("justify-between")} onClick={() => setSelected(d.version)}>
                  <span>v{d.version}</span>
                  <span className="flex items-center gap-1 text-xs opacity-80">{d.edited_by_human ? t("script.drafts.human") : t("script.drafts.claude")}{d.has_feedback && <MessageSquareIcon className="size-3" />}</span>
                </Button>
              ))}
              <div className="mt-1 text-xs text-muted-foreground">{t("script.drafts.latest", { when: when(drafts[drafts.length - 1].modified) })}</div>
            </CardContent>
          </Card>
          <DraftEditor key={current} id={id} version={current} latest={latest} />
        </div>
      )}
      <ScriptJson id={id} />
      <LintPanel project={id} />
    </div>
  );
}
