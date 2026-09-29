import type en from "../en/storyboard";
import type { Messages } from "../types";

const storyboard: Messages<typeof en> = {
  description: "已批准的關鍵畫面、對白文字和時間集中在一頁。未有已批准關鍵畫面的鏡頭會顯示最新版本，並標示「not approved」。",
  open: "開啟以列印／儲存 PDF",
  render: "生成新版本",
  rendering: "生成中……",
  rendered: "已生成 {{file}}",
  emptyTitle: "未有已生成的分鏡",
  emptyBody: "需要 script.json 和 shotlist.json。生成分鏡免費（不會呼叫 API）。",
  frameTitle: "分鏡 {{file}}",
  pdfHelp: "製作 PDF：開啟分鏡，按 <kbd>Ctrl</kbd>+<kbd>P</kbd>，然後選擇「另存為 PDF」（A4 橫向）。",
};

export default storyboard;
