import type en from "../en/settings";
import type { Messages } from "../types";

const settings: Messages<typeof en> = {
  title: "設定",
  description: "只供檢視。請在 <0>.env</0> 和 <1>config/*.yaml</1> 修改數值，然後重新整理。",
  budget: {
    title: "預算及金鑰（.env）",
    maxPerRun: "每次執行支出上限",
    monthly: "每月預算",
    currency: "顯示貨幣",
    adminKey: "FAL_ADMIN_KEY（費用同步、餘額）",
  },
  pipeline: {
    title: "流程（config/pipeline.yaml）",
    keyframeVariants: "每個鏡頭的關鍵畫面變體數量",
    reroll: "重新生成係數（預測）",
    sheetVariants: "角色設定圖變體數量",
    usdToHkd: "USD → HKD",
  },
  models: {
    title: "圖像模型（config/models.yaml）",
    description: "第一項為預設模型。",
    key: "代號",
    textEndpoint: "文字端點",
    editEndpoint: "編輯端點（附參考圖）",
    verified: "已核實",
  },
  prices: {
    title: "價格（config/prices.yaml）",
    check: "與 fal 核對",
    checking: "核對中…",
    endpoint: "端點",
    ours: "我們的價格",
    unit: "單位",
    verified: "已核實",
    falNow: "fal 現價",
    notFound: "找不到",
  },
  set: "已設定",
  missing: "缺少",
  no: "否",
};

export default settings;
