const shell = {
  nav: { projects: "Projects", characters: "Characters", costs: "Costs", settings: "Settings" },
  openMenu: "Open menu",
  statusBar: {
    label: "Status",
    month: "This month",
    job: "{{kind}} {{done}}/{{total}}",
    jobQueued: "{{kind}} queued",
    falMissing: "FAL_KEY not set",
    local: "Local only",
    localTitle: "Runs on this computer (127.0.0.1). Nothing is hosted online.",
    language: "Language",
  },
  jobKinds: {
    keyframes: "Keyframes", character: "Character sheet", voice: "Voice", voice_preview: "Voice preview",
    clips: "Clips", lipsync: "Lip-sync",
  },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
};

export default shell;
