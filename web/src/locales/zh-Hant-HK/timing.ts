import type en from "../en/timing";
import type { Messages } from "../types";

const timing: Messages<typeof en> = {
  titleTts: "來自配音音軌的時間",
  titleEstimate: "估算時間",
  descTts: "已批准配音版本的實際長度。重新估算會以字數估算取代。",
  descEstimate: "按字數計算。建立配音音軌（「配音」分頁）後會以實際時間取代。",
  realNote: "實際時間：請在「配音」分頁重新建立",
  estimate: "估算時間",
  reestimate: "重新估算",
  estimated: "估算為 {{seconds}} 秒",
  needsScript: "需要先有 script.json。",
  summary: "{{seconds}} 秒，每秒 {{rate}} 字",
  target: "目標長度 {{seconds}} 秒",
  over: "超出目標 10% 以上，請縮短對白。",
  headers: { line: "對白", text: "文字", chars: "字數", start: "開始", end: "結束", position: "位置" },
};

export default timing;
