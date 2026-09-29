const script = {
  handoff: {
    title: "Next round with Claude Code",
    description: "Paste this into Claude Code in the terminal. The new draft appears here when you refresh.",
    copy: "Copy prompt",
    languageNote: "",
  },
  draft: {
    older: "older version",
    description: "Saving never overwrites: it creates a new version marked as edited by a human.",
    discardEdits: "Discard",
    saveAs: "Save as v{{n}}",
    saved: "Saved as {{file}}",
  },
  feedback: {
    title: "Feedback on v{{n}}",
    description: "Saved as {{file}} for Claude's next draft.",
    save: "Save feedback",
    saved: "Feedback saved — Claude reads it next round",
    placeholder: "e.g. L03 too long; hook needs a question; keep 张叔's line as is…",
  },
  drafts: {
    title: "Drafts",
    refresh: "Refresh",
    human: "human",
    claude: "Claude",
    latest: "latest {{when}}",
    emptyTitle: "No script drafts yet",
    emptyBody: "Fill in the brief, then paste the prompt above into Claude Code to get script_v1.md.",
  },
  json: {
    emptyTitle: "No script.json yet",
    emptyBody: "When the draft is agreed, ask Claude Code to convert it (the prompt above says how).",
    title: "script.json — {{title}}",
    summary_one: "{{count}} line · ≈{{seconds}}s speech (target {{target}}s)",
    summary_other: "{{count}} lines · ≈{{seconds}}s speech (target {{target}}s)",
    headers: { beat: "Beat", id: "ID", speaker: "Speaker", voice: "Voice", subtitle: "Subtitle", chars: "Chars", seconds: "≈ s" },
  },
  claims: {
    title: "Claims — partner fact-check",
    description: "Every medical or insurance fact stays unverified until approved here.",
    none: "No claims listed.",
    lines: "lines {{ids}}",
    notePlaceholder: "source / note",
    reject: "Reject",
    toast: "{{id}} {{status}}",
    status: { unverified: "unverified", approved: "approved", rejected: "rejected" },
    headers: { id: "ID", claim: "Claim", status: "Status", note: "Note" },
  },
};

export default script;
