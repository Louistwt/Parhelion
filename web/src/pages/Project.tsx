import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ProjectDetail } from "../api";
import { ErrorBox, Loading, PageHeader, StageDot } from "../components/common";
import { useMoney } from "../format";
import { BriefTab } from "./tabs/Brief";
import { ClipsTab } from "./tabs/Clips";
import { KeyframesTab } from "./tabs/Keyframes";
import { ScriptTab } from "./tabs/Script";
import { ShotsTab } from "./tabs/Shots";
import { StoryboardTab } from "./tabs/Storyboard";
import { TimingTab } from "./tabs/Timing";
import { VideoTab } from "./tabs/Video";
import { VoiceTab } from "./tabs/Voice";

/** Tab key (URL) → stage; the label is `common.stages.<stage>`. */
const TABS = [
  { key: "brief", stage: "brief" },
  { key: "script", stage: "script" },
  { key: "voice", stage: "voice" },
  { key: "timing", stage: "timing" },
  { key: "shots", stage: "shotlist" },
  { key: "keyframes", stage: "keyframes" },
  { key: "storyboard", stage: "storyboard" },
  { key: "clips", stage: "clips" },
  { key: "video", stage: "video" },
] as const;

export function Project() {
  const { t } = useTranslation();
  const { id = "", tab = "brief" } = useParams();
  const nav = useNavigate();
  const money = useMoney();
  const q = useQuery({ queryKey: ["project", id], queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`) });
  const p = q.data;
  return (
    <div>
      <PageHeader
        crumb={<><Link to="/" className="hover:text-foreground">{t("shell.nav.projects")}</Link> / {id}</>}
        title={p?.slug ?? id}
        description={p && t("project.summary", {
          language: t(p.language === "mandarin" ? "project.languages.mandarin" : "project.languages.cantonese"),
          seconds: p.target_seconds,
          spent: money(p.spend),
        })}
      />
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {p && (
        <Tabs value={tab} onValueChange={(v) => nav(`/p/${id}/${v}`)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto">
            {TABS.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="flex-none gap-1.5">
                <StageDot status={p.stages[s.stage]} /> {t(`common.stages.${s.stage}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="brief"><BriefTab id={id} /></TabsContent>
          <TabsContent value="script"><ScriptTab id={id} /></TabsContent>
          <TabsContent value="timing"><TimingTab id={id} target={p.target_seconds} /></TabsContent>
          <TabsContent value="shots"><ShotsTab id={id} /></TabsContent>
          <TabsContent value="keyframes"><KeyframesTab id={id} /></TabsContent>
          <TabsContent value="storyboard"><StoryboardTab id={id} /></TabsContent>
          <TabsContent value="voice"><VoiceTab id={id} /></TabsContent>
          <TabsContent value="clips"><ClipsTab id={id} /></TabsContent>
          <TabsContent value="video"><VideoTab id={id} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
