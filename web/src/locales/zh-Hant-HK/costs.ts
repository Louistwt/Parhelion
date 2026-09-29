import type en from "../en/costs";
import type { Messages } from "../types";

const costs: Messages<typeof en> = {
  title: "費用",
  description: "每次呼叫前會記錄估算；與 fal 同步後會填入實際費用。",
  refreshBalance: "重新整理 fal 餘額",
  sync: "同步實際費用",
  synced: "{{events}} 項計費事件（{{total}}）；已更新 {{updated}} 行",
  tiles: {
    month: "本月支出（{{month}}）",
    over: "▲ 超出預算",
    near: "● 接近預算",
    within: "✓ 未超出預算",
    ofBudget: "預算 {{amount}} 的 {{pct}}%",
    balance: "fal 餘額",
    balanceLive: "即時取自 fal",
    balanceHint: "按「重新整理」（需要 FAL_ADMIN_KEY）",
    allTime: "累計支出",
    images: "{{n}} 張圖像",
    requests: "{{n}} 個請求",
    failed: "{{n}} 個失敗",
    syncedWithFal: "已與 fal 同步",
    perRunCap: "每次執行上限 {{amount}}",
  },
  perDay: "每日支出（最近 30 日）",
  byProject: "按項目",
  byStage: "按階段",
  byModel: "按模型",
  forecast: {
    title: "預測：完成關鍵畫面的費用",
    description: "每個鏡頭的變體數量和重新生成係數取自 config/pipeline.yaml；價格取自 config/prices.yaml。",
    empty: "尚未有項目。",
  },
  estVsActual: {
    title: "估算與實際",
    empty: "尚未同步任何紀錄（需要 FAL_ADMIN_KEY）。",
  },
  recent: {
    title: "最近的請求",
    description: "* 估算，尚未同步",
    empty: "尚未記錄任何請求。",
  },
  cols: {
    project: "項目",
    basis: "依據",
    model: "模型",
    images: "圖像",
    estimate: "估算",
    requests: "請求",
    estimated: "估算",
    actual: "實際",
    difference: "差額",
    time: "時間（UTC）",
    stage: "階段",
    units: "單位",
    cost: "費用",
    status: "狀態",
  },
  statuses: { ok: "成功", failed: "失敗" },
  charts: {
    noSpend: "尚未有支出。",
    noSpend30: "最近 30 日沒有支出。",
    dailyLabel: "每日支出，最近 30 日",
  },
};

export default costs;
