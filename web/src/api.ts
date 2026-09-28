// Typed client for the local Parhelion API (parhelion/api/app.py).

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
};

export const fileUrl = (area: "projects" | "library", ...parts: string[]) =>
  `/files/${area}/${parts.map(encodeURIComponent).join("/")}`;

// ---------- types ----------

export type Stages = Record<string, string>;

export interface ProjectSummary {
  id: string;
  slug: string;
  language: "mandarin" | "cantonese";
  target_seconds: number;
  stages: Stages;
  created: string;
  shots: number;
  approved_keyframes: number;
  spend: number;
  drafts: number;
  has_script: boolean;
}

export interface Overview {
  projects: ProjectSummary[];
  month_spend: number;
  monthly_budget: number;
  library_spend: number;
  has_fal_key: boolean;
  jobs_active: boolean;
}

export interface ProjectDetail {
  id: string;
  slug: string;
  language: "mandarin" | "cantonese";
  target_seconds: number;
  stages: Stages;
  approvals: { what: string; value: string; by: string; at: string }[];
  files: Record<string, boolean>;
  spend: number;
}

export interface Draft {
  version: number;
  name: string;
  modified: string;
  edited_by_human: boolean;
  has_feedback: boolean;
}

export interface ScriptLine {
  id: string;
  speaker: string;
  text_voice: string;
  text_subtitle: string;
  emotion: string;
  on_screen_text: string;
  sfx: string;
  chars: number;
  seconds: number;
}

export interface Claim {
  id: string;
  text: string;
  line_ids: string[];
  status: "unverified" | "approved" | "rejected";
  note: string;
}

export interface Script {
  title: string;
  language: string;
  target_seconds: number;
  format: string;
  characters: string[];
  beats: { name: string; line_ids: string[] }[];
  lines: ScriptLine[];
  claims: Claim[];
}

export interface LintResult {
  scope: string;
  issues: { level: "error" | "warn"; where: string; message: string }[];
  errors: number;
  warnings: number;
}

export interface Timing {
  source: string;
  chars_per_second: number;
  total_seconds: number;
  lines: { line_id: string; chars: number; start: number; end: number }[];
}

export interface Voice {
  voice_id: string;
  speed: number;
  pitch: number;
  emotion: string | null;
}

export interface Character {
  name: string;
  display_name: string;
  prompt_block: string;
  style: string | null;
  face_ref: string | null;
  approved_sheets: string[];
  sheets: string[];
  voice: Voice | null;
  voice_previews: string[];
}

export interface CharacterList {
  characters: Character[];
  styles: string[];
  default_style: string;
}

export interface VoiceCatalog {
  catalog: Record<"mandarin" | "cantonese", { id: string; label: string }[]>;
  emotions: string[];
  narrator: Record<string, Voice>;
}

export interface VoiceLine {
  id: string;
  speaker: string;
  text: string;
  subtitle: string;
  emotion: string;
  voice: Voice | null;
  voice_error: string | null;
  takes: { file: string; duration: number | null }[];
  approved: string | null;
}

export interface VoiceResp {
  lines: VoiceLine[] | null;
  language: string;
  target_seconds: number;
  track: string | null;
  timing: Timing | null;
}

export interface ClipShot {
  id: string;
  start: number;
  end: number;
  duration: number;
  text: string;
  keyframe: string | null;
  on_camera_speech: boolean;
  motion_prompt: string;
  camera: string;
  prompt: string;
  clips: string[];
  lipsync: string[];
  approved: string | null;
}

export interface Render {
  version: number;
  rough_cut: string;
  clean: string;
  srt: string;
  capcut: string;
  duration: number;
  voice: string | null;
  created: string;
  shots: { shot: string; start: number; end: number; source: string; file: string | null; lines: string[] }[];
}

export interface Shot {
  id: string;
  start: number;
  end: number;
  duration: number;
  line_ids: string[];
  framing: string;
  characters: string[];
  props: string[];
  setting: string;
  action: string;
  notes: string;
  on_camera_speech: boolean;
  motion_prompt: string;
  camera: string;
  approved_keyframe: string | null;
  lines: { id: string; speaker: string; text: string }[];
  prompt: string;
}

export interface KeyframeShot {
  id: string;
  start: number;
  end: number;
  framing: string;
  characters: string[];
  action: string;
  text: string;
  variants: string[];
  approved: string | null;
}

export interface RunRequest {
  kind: "keyframes" | "character" | "voice" | "voice_preview" | "clips" | "lipsync";
  project?: string;
  name?: string;
  line_ids?: string[];
  text?: string;
  language?: "mandarin" | "cantonese";
  shot_ids?: string[];
  n?: number;
  model?: string;
  use_approved?: boolean;
  include_approved?: boolean;
}

export interface Estimate {
  items: { label: string; endpoint: string; units: number; unit: string; unit_price: number; cost: number }[];
  total: number;
  month_spent: number;
  monthly_budget: number;
  max_per_run: number;
  warnings: string[];
  blocked_reason: string | null;
  notes: string[];
  has_fal_key: boolean;
  requests: { label: string; endpoint: string; model: string; n: number; references: number; prompt: string }[];
}

export interface JobEvent {
  ts: string;
  event: "start" | "saved" | "failed";
  message: string;
  label: string;
}

export interface Job {
  id: string;
  kind: string;
  project: string;
  labels: string[];
  estimate: number;
  status: "queued" | "running" | "done" | "failed" | "blocked";
  created: string;
  finished: string | null;
  progress: { done: number; total: number };
  events: JobEvent[];
  files: Record<string, string[]>;
  error: string | null;
}

export interface ImageModel {
  key: string;
  provider: string;
  text_endpoint: string;
  edit_endpoint: string;
  verified: string | null;
  params: Record<string, unknown>;
}

export interface StageModel {
  key: string;
  provider: string;
  endpoint: string;
  verified: string | null;
  durations?: number[];
  params: Record<string, unknown>;
}

export interface Settings {
  max_spend_per_run: number;
  monthly_budget: number;
  currency: string;
  has_fal_key: boolean;
  has_fal_admin_key: boolean;
  models: ImageModel[];
  tts_models: StageModel[];
  video_models: StageModel[];
  lipsync_models: StageModel[];
  system: { ffmpeg: string | null; ffmpeg_source: string | null; font: string | null };
  prices: Record<string, { unit: string; unit_price: number; source: string; verified: string | null }>;
  pipeline: {
    keyframes: { variants_per_shot: number; reroll_factor: number };
    characters: { variants: number };
    clips: { variants_per_shot: number };
    report: { usd_to_hkd: number };
    [k: string]: unknown;
  };
  root: string;
}

export interface Bar {
  label: string;
  value: number;
  pct: number;
}

export interface Costs {
  generated: string;
  currency: string;
  usd_to_hkd: number;
  month: string;
  month_spend: number;
  budget: number;
  budget_pct: number;
  budget_state: "ok" | "near" | "over";
  per_run: number;
  all_time: number;
  images: number;
  ok: number;
  failed: number;
  synced: number;
  days: { peak: number; first: string; last: string; cols: { day: string; value: number }[] };
  by_project: Bar[];
  by_stage: Bar[];
  by_model: Bar[];
  est_vs_actual: { model: string; est: number; actual: number; n: number }[];
  finish: { project: string; basis: string; images: number; model: string; est: number }[];
  recent: {
    ts: string;
    project: string;
    stage: string;
    model: string;
    units: number;
    cost: number;
    status: string;
    actual_cost_usd: number | null;
    note: string;
  }[];
}
