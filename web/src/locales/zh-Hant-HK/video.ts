import type en from "../en/video";
import type { Messages } from "../types";

const video: Messages<typeof en> = {
  renderedToast: "已輸出 {{file}}（{{seconds}} 秒）",
  title: "粗剪",
  description:
    "免費（在這部電腦上用 FFmpeg）。使用已批准的片段；沒有片段的鏡頭會用關鍵畫面加慢速推近，" +
    "所以配音音軌一完成便可輸出動態分鏡。輸出：有字幕的 MP4、無字幕版 MP4、SRT 字幕檔及 CapCut 資料夾。",
  rendering: "輸出中…（約 1 分鐘）",
  render: "輸出新版本",
  noFfmpeg: "找不到 ffmpeg。請執行 <code>sudo apt install ffmpeg</code>（或用 <code>uv sync</code> 重新安裝）。",
  noFont: "沒有可用於字幕的中文字型。請執行 <code>sudo apt install fonts-noto-cjk</code>。",
  sysInfo: "ffmpeg：{{source}} · 字幕字型：{{font}}",
  empty: {
    title: "未有粗剪",
    body: "需要 script.json、鏡頭表及時間（最好已有配音音軌）。",
  },
  voice: "配音：{{file}}",
  noVoice: "沒有配音（無聲）",
  stills_one: "{{count}} 個靜態鏡頭",
  stills_other: "{{count}} 個靜態鏡頭",
  capcutTitle: "CapCut 用檔案",
  copyPath: "複製路徑",
  capcutHelp:
    "資料夾內有每個已裁至長度的鏡頭（clips/S01.mp4…）、配音音軌及每句對白的音訊、subtitles.srt，以及列明匯入次序的 README。" +
    "在 Windows：於檔案總管打開 <code>\\\\wsl$</code>，再貼上路徑。",
  shotsTitle: "此版本的鏡頭",
  cols: { shot: "鏡頭", start: "開始", end: "結束", source: "來源", lines: "對白" },
  sources: {
    clip: "片段",
    still: "靜態",
    "still (not approved)": "靜態（未批准）",
    black: "黑畫面",
  },
};

export default video;
