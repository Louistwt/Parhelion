import type en from "../en/shell";
import type { Messages } from "../types";

const shell: Messages<typeof en> = {
  nav: { projects: "項目", characters: "角色", costs: "費用", settings: "設定" },
  openMenu: "開啟選單",
  statusBar: {
    label: "狀態",
    month: "本月",
    job: "{{kind}} {{done}}/{{total}}",
    jobQueued: "{{kind}} 排隊中",
    falMissing: "未設定 FAL_KEY",
    local: "只限本機",
    localTitle: "在這部電腦上執行（127.0.0.1），沒有放到網上。",
    language: "語言",
  },
  jobKinds: {
    keyframes: "關鍵畫面", character: "角色設定圖", voice: "配音", voice_preview: "試聽配音",
    clips: "片段", lipsync: "對嘴",
  },
  theme: { label: "主題", light: "淺色", dark: "深色", system: "跟隨系統" },
};

export default shell;
