import type en from "../en/home";
import type { Messages } from "../types";

const home: Messages<typeof en> = {
  title: "項目",
  description: "簡報 → 劇本 → 時間 → 鏡頭 → 關鍵畫面 → 分鏡",
  spendThisMonth: "本月支出",
  ofBudget: "預算 {{amount}}",
  falMissing: "尚未在 .env 設定 FAL_KEY。除圖像生成外，其他功能均可使用；請參閱 docs/setup.md。",
  empty: { title: "尚未有項目", body: "請在下方建立第一個項目。" },
  languages: { mandarin: "普通話", cantonese: "粵語" },
  next: "下一步：{{stage}}",
  clientReview: "客戶審閱",
  drafts_one: "{{count}} 份草稿",
  drafts_other: "{{count}} 份草稿",
  keyframesApproved: "已批准 {{approved}}/{{total}} 個關鍵畫面",
  spent: "已支出 {{amount}}",
  new: {
    title: "新增項目",
    description: "建立 projects/<date>-<slug>/ 及簡報範本。",
    slug: "代號（slug）",
    language: "語言",
    seconds: "目標長度（秒）",
    create: "建立",
    created: "已建立 {{id}}",
  },
};

export default home;
