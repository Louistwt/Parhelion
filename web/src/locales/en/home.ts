const home = {
  title: "Projects",
  description: "Brief → script → timing → shots → keyframes → storyboard",
  spendThisMonth: "Spend this month",
  ofBudget: "of {{amount}}",
  falMissing: "FAL_KEY is not set in .env. Everything except image generation works; see docs/setup.md.",
  empty: { title: "No projects yet", body: "Create your first project below." },
  languages: { mandarin: "Mandarin", cantonese: "Cantonese" },
  next: "Next: {{stage}}",
  clientReview: "client review",
  drafts_one: "{{count}} draft",
  drafts_other: "{{count}} drafts",
  keyframesApproved: "{{approved}}/{{total}} keyframes approved",
  spent: "spent {{amount}}",
  new: {
    title: "New project",
    description: "Creates projects/<date>-<slug>/ with a brief template.",
    slug: "Slug",
    language: "Language",
    seconds: "Target seconds",
    create: "Create",
    created: "Created {{id}}",
  },
};

export default home;
