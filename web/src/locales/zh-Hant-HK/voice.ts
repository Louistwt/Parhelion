import type en from "../en/voice";
import type { Messages } from "../types";

const voice: Messages<typeof en> = {
  empty: { title: "未有 script.json", body: "配音會根據定稿的劇本逐句生成。" },
  title: "配音 — 已批准 {{approved}}/{{total}} 句對白",
  description: "每句對白一個配音版本（每字約 {{price}}）。批准最好的配音版本，然後建立配音音軌：它決定影片的實際時間。",
  model: "配音模型",
  generateAll: "生成全部對白",
  missingVoice: "部分說話者未有配音聲線，請到<link>角色</link>頁選擇（旁白聲線：library/voices.yaml）。",
  approveNewest: "批准最新配音版本",
  approveNewestDone: "已批准每句未批准對白的最新配音版本",
  buildTrack: "建立配音音軌及時間",
  building: "建立中……",
  trackBuilt: "配音音軌 {{file}}：{{seconds}} 秒",
  retime: "重新對齊鏡頭時間",
  retimed: "鏡頭已移到實際時間",
  track: "配音音軌",
  trackLength: "{{seconds}} 秒（目標長度 {{target}} 秒）",
  overTarget: "超出目標",
  withinTarget: "符合目標",
  retimeOk: "按實際時間，所有鏡頭都在 3–8 秒之內。",
  retimeIssues: "{{issues}} — 請在「鏡頭」分頁調整（或請 Claude 拆分／合併鏡頭）。",
  line: {
    pickTake: "請選擇配音版本",
    speed: "語速 {{speed}}",
    newTake: "新配音版本",
    noTakes: "未有配音版本。",
    approvedToast: "{{id}}：已批准 {{file}}",
    duration: "{{seconds}} 秒",
  },
};

export default voice;
