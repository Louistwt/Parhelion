import type en from "../en/project";
import type { Messages } from "../types";

const project: Messages<typeof en> = {
  languages: { mandarin: "普通話", cantonese: "粵語" },
  summary: "{{language}} · 目標長度 {{seconds}} 秒 · 已支出 {{spent}}",
};

export default project;
