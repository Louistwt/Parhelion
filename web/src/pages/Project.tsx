import { useQuery } from "@tanstack/react-query";
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

const TABS = [
  { key: "brief", label: "Brief", stage: "brief" },
  { key: "script", label: "Script", stage: "script" },
  { key: "voice", label: "Voice", stage: "voice" },
  { key: "timing", label: "Timing", stage: "timing" },
  { key: "shots", label: "Shots", stage: "shotlist" },
  { key: "keyframes", label: "Keyframes", stage: "keyframes" },
  { key: "storyboard", label: "Storyboard", stage: "storyboard" },
  { key: "clips", label: "Clips", stage: "clips" },
  { key: "video", label: "Video", stage: "video" },
] as const;

export function Project() {
  const { id = "", tab = "brief" } = useParams();
  const nav = useNavigate();
  const money = useMoney();
  const q = useQuery({ queryKey: ["project", id], queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`) });
  const p = q.data;
  return (
    <div>
      <PageHeader
        crumb={<><Link to="/" className="hover:text-foreground">Projects</Link> / {id}</>}
        title={p?.slug ?? id}
        description={p && <>{p.language === "mandarin" ? "普通话 Mandarin" : "粤语 Cantonese"} · target {p.target_seconds}s · spent {money(p.spend)}</>}
      />
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error} />
      {p && (
        <Tabs value={tab} onValueChange={(t) => nav(`/p/${id}/${t}`)} className="gap-4">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="flex-none gap-1.5">
                <StageDot status={p.stages[t.stage]} /> {t.label}
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
