import type en from "../en/brief";
import type { Messages } from "../types";

const brief: Messages<typeof en> = {
  saved: "簡報已儲存（上一版本保留在 .history/）",
  guide: {
    title: "這裏要寫甚麼",
    intro: "簡報由人撰寫。Claude 會根據簡報建議大綱，但不會修改簡報。",
    format: "形式和語氣（幽默可有可無）",
    characters: "角色（在「角色」頁選擇）",
    keyPoint: "合作夥伴提供的重點，連同來源",
    beats: "想要的段落，按次序列出",
    avoid: "任何要避免的內容",
    history: "每次儲存都會把上一版本保留在 <code>.history/</code>。按 <kbd>Ctrl</kbd>+<kbd>S</kbd> 儲存。",
  },
  cast: {
    title: "演員表",
    description: "這條影片有哪些角色，以及每個角色穿哪個造型。關鍵畫面會使用該造型的參考圖；個別鏡頭可在「鏡頭」分頁另行設定。",
    empty: "尚未有角色。請在下方加入（劇本中的角色會自動列出）。",
    saved: "已儲存演員表",
    notSet: "主要造型",
    open: "開啟角色",
    lookFor: "{{name}} 的造型",
    missing: "角色庫中沒有這個角色",
    noReference: "這個造型尚未有已批准的全身圖 — 請在角色頁面生成。",
    reference: "參考圖：{{name}}",
    remove: "從演員表移除 {{name}}",
    add: "加入角色…",
  },
};

export default brief;
