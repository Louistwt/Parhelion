import type en from "../en/shots";
import type { Messages } from "../types";

const shots: Messages<typeof en> = {
  summary_one: "{{count}} 個鏡頭 · {{seconds}} 秒",
  summary_other: "{{count}} 個鏡頭 · {{seconds}} 秒",
  description: "打開鏡頭即可編輯畫面內容。對白文字和時間來自劇本；圖片在「關鍵畫面」分頁生成。",
  expandAll: "全部展開",
  collapseAll: "全部收起",
  saveAllCount: "全部儲存（{{count}}）",
  saveShot: "儲存 {{id}}",
  savedToast: "已儲存 {{ids}}",
  roomSavedToast: "已儲存場景參考",
  roomRef: "場景參考",
  roomNone: "無",
  roomHint: "一張已批准的場景關鍵畫面，會隨每張新關鍵畫面一併送出，讓場景保持一致。",
  timeline: "鏡頭時間軸",
  empty: {
    title: "未有鏡頭表",
    body: "請先估算時間，再請 Claude Code 建立 shotlist.json。",
  },
  promptTitle: "給 Claude Code 的提示詞",
  copyPrompt: "複製提示詞",
  // Sent to Claude Code: stays in English on purpose.
  claudePrompt:
    "Read CLAUDE.md, projects/{{id}}/script.json, projects/{{id}}/timing.json and library/prompt_templates.yaml. " +
    "Write projects/{{id}}/shotlist.json: shots of 3–8 s that follow timing.json, each with line_ids, framing (from prompt_templates framings), " +
    "characters (library names), props, setting and action only — no text in images. Then run `uv run parhelion lint {{id}}`.",
  durationRule: "鏡頭長度須為 {{min}}–{{max}} 秒",
  noLine: "（沒有對白）",
  narrator: "旁白",
  fields: {
    action: "畫面動作",
    actionHint: "畫面中發生甚麼；圖片內不可有文字",
    framing: "景別",
    setting: "場景",
    who: "出場角色",
    noCharacters: "角色庫中沒有角色",
    props: "道具",
    propsAdd: "新增…",
    propsPlaceholder: "例如：two car keys（按 Enter 新增）",
    motionSection: "動作與鏡頭運動（用於影片片段）",
    motion: "動作",
    motionHint: "一個簡單的動作",
    motionPlaceholder: "例如：he slowly pushes the keys across the desk",
    camera: "鏡頭運動",
    speaks: "角色鏡頭前說話（對嘴；需額外費用）",
    notes: "備註",
    notesHint: "會顯示在分鏡上",
    promptSection: "送往圖像模型的提示詞",
    promptBuilt: "由已儲存的欄位組成。",
    promptBuiltDirty: "由已儲存的欄位組成（儲存後更新）。",
  },
  cameras: {
    "static camera": "固定鏡頭",
    "slow push in": "緩慢推近",
    "slow pull out": "緩慢拉遠",
    "slow pan left": "緩慢向左搖",
    "slow pan right": "緩慢向右搖",
    "subtle handheld": "輕微手持",
  },
  framings: {
    wide: "遠景",
    medium: "中景",
    "medium close-up": "中近景",
    "close-up": "特寫",
    "over-the-shoulder": "過肩鏡頭",
    insert: "細節特寫",
    "two-shot": "雙人鏡頭",
  },
};

export default shots;
