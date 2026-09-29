import type en from "../en/script";
import type { Messages } from "../types";

const script: Messages<typeof en> = {
  handoff: {
    title: "與 Claude Code 進行下一輪",
    description: "把以下內容貼到終端機的 Claude Code。重新整理後，新草稿會在這裏出現。",
    copy: "複製提示詞",
    languageNote: "提示詞以英文提供給 Claude Code。",
  },
  draft: {
    older: "舊版本",
    description: "儲存不會覆蓋原檔：會建立一個標記為人手修改的新版本。",
    discardEdits: "放棄修改",
    saveAs: "另存為 v{{n}}",
    saved: "已另存為 {{file}}",
  },
  feedback: {
    title: "對 v{{n}} 的意見",
    description: "儲存為 {{file}}，供 Claude 撰寫下一版草稿。",
    save: "儲存意見",
    saved: "意見已儲存，Claude 會在下一輪讀取",
    placeholder: "例如：L03 太長；開場需要一個問題；張叔的對白保持不變……",
  },
  drafts: {
    title: "草稿",
    refresh: "重新整理",
    human: "人手",
    claude: "Claude",
    latest: "最新 {{when}}",
    emptyTitle: "未有劇本草稿",
    emptyBody: "先填寫簡報，再把上面的提示詞貼到 Claude Code，即可得到 script_v1.md。",
  },
  json: {
    emptyTitle: "未有 script.json",
    emptyBody: "草稿定稿後，請 Claude Code 轉換（上面的提示詞有說明）。",
    title: "script.json — {{title}}",
    summary_one: "{{count}} 句對白 · 約 {{seconds}} 秒語音（目標長度 {{target}} 秒）",
    summary_other: "{{count}} 句對白 · 約 {{seconds}} 秒語音（目標長度 {{target}} 秒）",
    headers: { beat: "段落", id: "編號", speaker: "說話者", voice: "配音文字", subtitle: "字幕", chars: "字數", seconds: "約秒數" },
  },
  claims: {
    title: "事實陳述 — 合作夥伴核實",
    description: "所有醫療或保險事實在這裏批准之前，都維持未核實。",
    none: "沒有列出事實陳述。",
    lines: "對白 {{ids}}",
    notePlaceholder: "來源／備註",
    reject: "否決",
    toast: "{{id}} {{status}}",
    status: { unverified: "未核實", approved: "已批准", rejected: "已否決" },
    headers: { id: "編號", claim: "事實陳述", status: "狀態", note: "備註" },
  },
};

export default script;
