# How to write a brief

A brief is the one-page plan for a video. **Humans own it**: you and your partner decide who is in it,
the one thing viewers should learn, the tone and the order of events. Claude reads the brief to propose an
outline and draft lines, but never changes the brief and never decides what is funny or true.

A good brief takes 20–30 minutes and saves hours of script back-and-forth.

Worked example: [briefs/demo-b-oesophageal.md](briefs/demo-b-oesophageal.md).

---

## The sections, one by one

`parhelion new <slug>` (or **New project** in the app) creates `brief.md` with these sections.

| Section | What to write | Example |
|---|---|---|
| **Language** | 普通话 (Mandarin) or 粤语 (Cantonese). Cantonese videos get spoken Cantonese audio + written-Chinese subtitles. | Mandarin |
| **Target length** | 30, 60 or 90 seconds. 60 s is the sweet spot for one idea. | 60 s |
| **Format** | How the video is told (see *Formats* below). | Skit |
| **Tone** | 3–6 words. Humour is optional. | Light, warm teasing of habits |
| **Characters** | Names from the Characters page, with one line on each one's role. | 小王 — young agent; 张叔 — client |
| **Key point** | The ONE HK-vs-mainland difference viewers must remember. From your partner. One sentence. | HK medical plans can be guaranteed renewable into old age; many mainland plans renew yearly. |
| **What to say** | One sentence an agent can repeat to a real client. Humans write or pick it. | 您家里长寿是好事，那保障也要一样长寿。 |
| **Beats** | The order of events (see *Beats* below). | hook → setup → key_point → what_to_say → close |
| **Facts to use** | Every medical or insurance fact the video relies on, **with a source**. Your partner confirms each one. | IARC 2016: very hot drinks > 65 °C "probably carcinogenic" |
| **Must avoid** | Anything the video must not say or show. | Company names, fear tactics, jokes about symptoms |
| **Notes / ideas** | Anything else: a visual gag, a phrase clients really use, a reference video. | Uncle Zhang's giant tea jar |

---

## Formats

| Format | What it looks like | Good for | Watch out |
|---|---|---|---|
| **Skit** | Two recurring cartoon characters act out a sales moment. | Objections, habits, awkward moments. Most memorable. | Needs 2 approved characters; more shots. |
| **Talking head** | One presenter speaks to camera, fast cuts, on-screen captions. | Myth-busting, quick facts. Cheapest to storyboard. | Needs a strong hook; can feel like a lecture. |
| **Explainer (voiceover)** | Narrator over simple illustrations or props. | Comparisons (HK vs mainland), processes. | Keep visuals simple — no text inside images. |
| **Q&A / myth-buster** | "Client asks → agent answers", 2–3 rounds. | Several related misconceptions. | Still ONE key point; the rounds support it. |
| **Objection → reply** | Client objection, freeze-frame, "what a good agent says". | Training agents on wording. | The reply must be compliant and factual. |

---

## Beats (for first-timers)

A **beat** is one step of the story with one job. Every video in this project uses the same five beats by
default; you can rename, merge or reorder them in the brief.

| Beat | Its job | Ask yourself |
|---|---|---|
| **hook** | Make the viewer stop scrolling in the first 3 seconds. A question, a surprising line, or a moment they recognise. | "Would an agent think *I've heard that before*?" |
| **setup** | Show the client's belief or excuse. This is where the relatable scene lives. | "What does the client actually say?" |
| **key_point** | Deliver the ONE difference, factually and simply. | "Can an agent repeat this after one viewing?" |
| **what_to_say** | Give the agent one reusable sentence for a real conversation. | "Would this sound natural to a client?" |
| **close** | Land the ending (payoff of the setup) and recap the point in a few words. | "Does the ending call back to the hook?" |

### Timing and speech budget

Spoken Chinese runs about **4.5 characters/second** (Mandarin) or **5** (Cantonese). Leave ~15% of each beat for
pauses, reactions and visual moments. The app's **Timing** tab and `parhelion lint` check this for you.

| Beat | 30 s video | 60 s video | 90 s video | ≈ Mandarin characters (60 s) |
|---|---|---|---|---|
| hook | 0–3 s | 0–4 s | 0–5 s | ~15 |
| setup | 3–10 s | 4–18 s | 5–25 s | ~55 |
| key_point | 10–20 s | 18–40 s | 25–60 s | ~85 |
| what_to_say | 20–26 s | 40–52 s | 60–78 s | ~45 |
| close | 26–30 s | 52–60 s | 78–90 s | ~30 |
| **total** | | | | **~230** |

For comparison: this sentence — 您家里长寿是好事，那保障也要一样长寿 — is 17 spoken characters, about 4 seconds.

### Tips
- **One key point.** If you have two, make two videos.
- **The setup and close should mirror each other.** The client's excuse at the start is answered at the end.
- **Show, don't say.** A habit (a steaming tea jar) is faster than a sentence explaining it.
- **Humour (optional) targets behaviour**: excuses, habits, awkward sales moments. Never patients, symptoms or death.

---

## Facts and claims

- Every medical or insurance fact goes in **Facts to use** with a source (link, document name, or "partner's experience").
- Claude copies them into the script's `claims` list as **unverified**. Your partner approves or rejects each one in the
  app (Script tab → Claims). Nothing is final until approved.
- **No invented numbers.** If you need a statistic you don't have, write `[TODO: partner — number + source]`.
- **No company, product or policy names.** Say "a mainland one-year medical plan", not a brand. Add names you want
  blocked to `library/banned_terms.txt` so lint catches them.
- No fear tactics. Consequences must be factual and calm.

---

## Checklist before handing the brief to Claude

- [ ] Language, length and format chosen
- [ ] Characters exist on the Characters page (or are listed as "to create")
- [ ] ONE key point, in one sentence, chosen by your partner
- [ ] Every fact has a source (or is marked `[TODO: partner]`)
- [ ] Beats listed in order, with a line on what happens in each
- [ ] Must-avoid list filled in
- [ ] Saved in the app (Brief tab) → then Script tab → **Copy prompt** → paste into Claude Code
