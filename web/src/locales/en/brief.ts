const brief = {
  saved: "Brief saved (previous version kept in .history/)",
  guide: {
    title: "What goes here",
    intro: "The brief is written by humans. Claude reads it to propose an outline but never changes it.",
    format: "Format and tone (humour optional)",
    characters: "Characters (from the Characters page)",
    keyPoint: "The key point from your partner, with sources",
    beats: "The beats you want, in order",
    avoid: "Anything to avoid",
    history: "Each save keeps the previous version in <code>.history/</code>. <kbd>Ctrl</kbd>+<kbd>S</kbd> saves.",
  },
  cast: {
    title: "Cast",
    description: "Who is in this video and which look each wears. Keyframes use that look's reference image; a shot can override it on the Shots tab.",
    empty: "No characters yet. Add one below (the script's characters appear here automatically).",
    saved: "Cast saved",
    notSet: "main look",
    open: "Open the character",
    lookFor: "Look for {{name}}",
    missing: "Not in the character library",
    noReference: "This look has no approved full-body image yet — generate one on the character's page.",
    reference: "Reference: {{name}}",
    remove: "Remove {{name}} from the cast",
    add: "Add a character…",
  },
};

export default brief;
