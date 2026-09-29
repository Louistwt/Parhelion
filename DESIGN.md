# Parhelion — Design

How the Parhelion app looks, reads and behaves. Read this before any UI work; CLAUDE.md points here.
Visual reference: `docs/design/palettes.html` (palette 3, "Parhelion gold", was chosen on 2026-09-29, without the
per-stage colours shown there).

## Principles

We borrow ideas, never branding:

| From | We take | In Parhelion |
|---|---|---|
| **Stripe** | Calm, trustworthy clarity | Soft cool-grey surfaces, navy text, one main colour for actions, tinted (not loud) status badges, generous spacing, one primary button per view. |
| **CapCut** | Media first | Thumbnails are the hero of every screen that has them; text supports the picture. |
| **VS Code** | Workspace ergonomics | A status bar for global state; semantic tokens instead of raw colours; visible focus; keyboard hints (`←` `→` `Enter` `Esc` in the image viewer). |

And three rules of our own:

1. **Money is always visible.** Anything that costs money is violet (`spend`) and shows its cost. Nothing else is violet.
2. **Status is one scheme everywhere.** A stage, a shot or a claim that is "done" looks the same wherever it appears.
   Status is shown by **shape and colour**, never colour alone.
3. **Every screen names the next step.** Empty states and blocked actions say what to do, not only what's missing.

## Colour

Tokens live in `web/src/index.css` (`:root` = light, `.dark` = dark) and are exposed to Tailwind through `@theme`.
Use the token names (`bg-primary`, `text-primary-ink`, `bg-spend` …), never hex values in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#f6f7fa` | `#0e1320` | App ground |
| `card` / `popover` | `#ffffff` | `#161c2c` | Cards, dialogs, menus |
| `sidebar` | `#eef1f6` | `#121827` | Sidebar and status bar |
| `border` | `#dde2ea` | `#2a3247` | Dividers, card edges |
| `foreground` | `#13203a` | `#eef1f7` | Text (navy) |
| `muted-foreground` | `#5a6478` | `#a2abbd` | Secondary text |
| `primary` | `#f2b01e` | `#ffc53d` | **Parhelion gold**: main buttons, selected states |
| `primary-hover` | `#dda00f` | `#ffd36b` | Hover on gold |
| `primary-foreground` | `#1a1f2e` | `#1a1405` | Text on gold (**never white**) |
| `primary-ink` | `#855700` | `#ffd36b` | Gold used **as text**: links, highlighted words |
| `primary-mark` | `#b07a00` | `#ffc53d` | Gold used **as a thin mark**: icons, underlines, bars, focus ring |
| `success` | `#1b6b43` | `#5cc98e` | Done, approved |
| `warning` | `#a93a0a` | `#ff8a4c` | Needs a look: unsaved, near budget |
| `destructive` | `#c0262d` | `#ff6b6b` | Errors, discard |
| `info` | `#2563a6` | `#7db2f0` | Unverified, neutral notes |
| `spend` | `#7c3aed` | `#b79cff` | **Paid actions only**, with their cost |
| `spend-foreground` | `#ffffff` | `#1a0f33` | Text on violet |

Rules:
- **Gold never carries white text.** Buttons on gold use `primary-foreground` (navy).
- **Gold as text or thin lines uses `primary-ink` / `primary-mark`.** Plain `#f2b01e` on white is only 1.9:1.
- **Violet means money.** A button is `variant="spend"` if and only if pressing it can cost money (it then opens the
  spend dialog). Put the cost in `<CostChip>` when it is known.
- Badges are tinted: `bg-<colour>/12` with `text-<colour>` (`Badge` variants `success`, `warning`, `info`,
  `destructive`, `spend`).
- Charts use `--chart-1…5` (gold-mark, info, spend, success, muted).
- Contrast: every text/background pair ≥ **4.5:1**, icons and marks ≥ **3:1**, in both themes (checked on 2026-09-29;
  re-check when a token changes).

### Status (one scheme for every stage)

| Status | Stage values | Mark | Colour token |
|---|---|---|---|
| To do | `todo`, missing | hollow ring | `status-todo` (grey) |
| In progress | `draft`, `in_progress`, `estimated` | half-filled | `status-progress` (gold mark) |
| Done | `agreed`, `approved`, `tts`, `done` | filled | `status-done` (green) |
| Needs attention | `failed`, `error` | filled with "!" | `status-attention` (red) |

Use `<StatusMark>`, `<StageDot>` or `<Stepper>` from `web/src/components/common.tsx`; don't colour stages yourself.
Stages have **no colours of their own**.

## Typography

- **Geist Variable** for Latin text (bundled). Chinese falls back to system fonts: "PingFang HK", "Microsoft JhengHei",
  "Noto Sans CJK TC" (繁體 first), then the Simplified families.
- Chinese reads better with more leading: `:lang(zh-Hant-HK) body { line-height: 1.65 }`.
- Sizes: page title 24 px semibold; card title 16 px semibold; body 14 px; secondary 12–13 px; script lines 15 px.
- Numbers that line up (money, times, counts) use `tabular-nums` / `font-mono`.
- EN: sentence case everywhere ("Generate all missing", not "Generate All Missing").

## Space, shape, elevation

- 4 px grid; component gaps 8–16 px, section gaps 16–24 px; page padding 24–32 px.
- Radius `--radius` 10 px (cards, dialogs), 8 px (buttons, inputs), full (badges, status marks).
- Elevation is rare: cards are flat with a border; dialogs and toasts get one soft shadow.

## Layout

```
┌ sidebar ─┬──────────── content (max 1280 px) ────────────┐
│ Projects │  crumb / page title / description               │
│ Characters│  tabs (with status marks)                      │
│ Costs    │  cards …                                        │
│ Settings │                                                 │
├──────────┴─────────────────────────────────────────────────┤
│ status bar: month spend · running job · FAL key · EN|繁 · theme · Local only │
└────────────────────────────────────────────────────────────┘
```

- **Sidebar**: navigation only. The active item gets the card background, semibold text and a gold-mark icon.
- **Status bar** (`web/src/components/StatusBar.tsx`): global state that must always be visible. Month spend uses the
  spend colour (warning colour at ≥ 80 % of budget).
- Project pages: header → stage tabs → the stage's cards. Pages keep one primary action in view.

## Components

- **Buttons**: `default` (gold) for the main action of a view, `secondary`/`outline` for the rest, `spend` for paid
  actions, `destructive` for discard/delete, `ghost` for toolbars, `link` (primary-ink) for inline links.
- **Spend dialog**: itemised estimate, budget line, then `Cancel` + `Spend <CostChip>` (spend variant).
- **Badges**: status words only (Approved, Unsaved, Unverified, Error…), tinted colours as above.
- **Empty states**: `<Empty title icon>` with the next step as its text.
- **Thumbnails**: 9:16, rounded 8 px; the approved one gets a success border and a check.
- **Toasts**: one line saying what happened ("Saved S01"); errors say how to fix it.
- **Image viewer (Lightbox)**: compare, approve (`Enter`), discard, close (`Esc`).

## Motion

Short (150–200 ms) colour/opacity transitions only; spinners for running jobs. Respect `prefers-reduced-motion`.

## Accessibility

- Contrast targets above, in both themes.
- Status by shape + colour; icons have `aria-label` or sit next to text.
- Visible focus ring (`ring` = gold mark) on every interactive element; everything reachable by keyboard.
- `<html lang>` follows the UI language, so screen readers and fonts switch correctly.

## Languages (i18n)

- UI languages: **English** and **繁體中文 (Hong Kong)** (`zh-Hant-HK`). Video content (scripts, subtitles) is
  separate and follows the video's own language.
- Every UI string goes through `t()` (react-i18next). Messages live in `web/src/locales/en/<section>.ts` and
  `web/src/locales/zh-Hant-HK/<section>.ts`; the Chinese file is typed against the English one, so a missing key fails
  `npm run typecheck`. `npm run i18n:check` fails on raw English in JSX.
- Text sent to machines stays English (prompts for Claude Code, camera/framing values sent to the video model); show a
  translated label next to it instead.
- The language switch is in the status bar; the choice is remembered per browser; the default follows the browser
  (zh-HK / zh-TW / zh-Hant → 繁體).
- Not translated yet: backend error messages, the static storyboard and cost-dashboard HTML.

### Writing 繁體中文 (Hong Kong)

Standard written Chinese (書面語) with Hong Kong vocabulary, no Cantonese colloquialisms (本月 not 今個月, 沒有 not 冇).
Full-width punctuation. Product names stay in English (Parhelion, Claude Code, CapCut, fal, Kling, Seedream, MiniMax).

| English | 繁體 (HK) | English | 繁體 (HK) |
|---|---|---|---|
| Project | 項目 | Keyframe | 關鍵畫面 |
| Brief | 簡報 | Storyboard | 分鏡 |
| Script | 劇本 | Clip | 片段 |
| Draft | 草稿 | Lip-sync | 對嘴 |
| Line | 對白 | Rough cut | 粗剪 |
| Narrator | 旁白 | Character | 角色 |
| Claim | 事實陳述 | Character sheet | 角色設定圖 |
| Unverified | 未核實 | Face reference | 面部參考 |
| Voice | 配音 | Room reference | 場景參考 |
| Take | 配音版本 / 版本 | Prompt | 提示詞 |
| Timing | 時間 | Approve / Discard | 批准 / 棄用 |
| Shot / Shot list | 鏡頭 / 鏡頭表 | Generate / Estimate | 生成 / 估算 |
| Setting / Action | 場景 / 畫面動作 | Cost / Spend / Budget | 費用 / 支出 / 預算 |
| Framing / Camera | 景別 / 鏡頭運動 | Checks | 檢查 |
| Props | 道具 | Subtitles | 字幕 |

## Checklist for UI changes

- [ ] Colours via tokens; gold text uses `primary-ink`; paid actions use `spend` with a cost.
- [ ] Status via `StatusMark` / `StageDot` / `Stepper`.
- [ ] New strings added to **both** locale files; `npm run typecheck && npm run i18n:check` pass.
- [ ] Empty/blocked states name the next step.
- [ ] Checked in light, dark, EN and 繁.
