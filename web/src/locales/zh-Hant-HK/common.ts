import type en from "../en/common";
import type { Messages } from "../types";

const common: Messages<typeof en> = {
  stages: {
    brief: "簡報", script: "劇本", voice: "配音", timing: "時間", shotlist: "鏡頭",
    keyframes: "關鍵畫面", storyboard: "分鏡", clips: "片段", video: "影片",
  },
  status: { todo: "未開始", progress: "進行中", done: "完成", attention: "需要處理" },
  actions: {
    save: "儲存", saveAll: "全部儲存", cancel: "取消", close: "關閉", copy: "複製", copied: "已複製",
    approve: "批准", approved: "已批准", discard: "棄用", generate: "生成", undo: "還原修改",
    add: "新增", remove: "移除 {{name}}",
  },
  loading: "載入中",
  copiedToast: "已複製，請貼到 Claude Code。",
  unsaved: "未儲存",
  notFound: "找不到此頁。",
  goHome: "返回項目",
  seconds: "{{n}} 秒",
  stageProgress: "階段進度",
  narrator: "旁白",
};

export default common;
