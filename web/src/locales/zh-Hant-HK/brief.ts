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
};

export default brief;
