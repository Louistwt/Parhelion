import type en from "../en/keyframes";
import type { Messages } from "../types";

const keyframes: Messages<typeof en> = {
  approvedToast: "{{id}}：已批准 {{name}}",
  discardedToast: "已棄用 {{name}}",
  pickOne: "請選一張",
  noLine: "（沒有對白）",
  generateVariants_one: "生成 {{count}} 個變體",
  generateVariants_other: "生成 {{count}} 個變體",
  generateMore_one: "再生成 {{count}} 個",
  generateMore_other: "再生成 {{count}} 個",
  noKeyframes: "未有關鍵畫面",
  empty: {
    title: "未有鏡頭表",
    body: "請先建立鏡頭表（「鏡頭」分頁）。",
  },
  approvedCount: "已批准 {{done}}/{{total}} 個鏡頭",
  help: "點擊縮圖即可比較、批准（<kbd>Enter</kbd>）或棄用。只有已批准的關鍵畫面會放上分鏡。",
  variants: "變體",
  generateAll: "生成所有欠缺的（{{count}}）",
};

export default keyframes;
