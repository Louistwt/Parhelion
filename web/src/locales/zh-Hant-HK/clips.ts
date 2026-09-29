import type en from "../en/clips";
import type { Messages } from "../types";

const clips: Messages<typeof en> = {
  approvedToast: "{{id}}：已批准 {{name}}",
  clipApproved: "片段已批准",
  speaks: "說話",
  approveKeyframeFirst: "請先批准關鍵畫面",
  motionPrompt: "動作提示詞（在「鏡頭」分頁編輯）",
  newTake: "新版本",
  animate: "生成動畫",
  lipsync: "對嘴",
  needTrack: "請先建立配音音軌",
  noClips: "未有片段。",
  empty: {
    title: "未有鏡頭表",
    body: "請先建立鏡頭表並批准關鍵畫面。",
  },
  title: "片段 — 已批准 {{done}}/{{total}}",
  description:
    "費用最高的階段：每張已批准的關鍵畫面會變成一段短片段（5–10 秒，在粗剪時裁至鏡頭長度）。" +
    "請先確認分鏡。每個鏡頭一個版本；只重新生成被否決的鏡頭。",
  videoModel: "影片模型",
  takes: "版本",
  animateAll: "為所有就緒鏡頭生成動畫（{{count}}）",
  lipsyncModel: "對嘴模型",
  lipsyncAll: "為說話鏡頭對嘴（{{count}}）",
  needTrackAlert: "對嘴需要配音音軌（「配音」分頁）。",
};

export default clips;
