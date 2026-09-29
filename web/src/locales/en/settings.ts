const settings = {
  title: "Settings",
  description: "Read-only. Change values in <0>.env</0> and <1>config/*.yaml</1>, then refresh.",
  budget: {
    title: "Budget & keys (.env)",
    maxPerRun: "Max spend per run",
    monthly: "Monthly budget",
    currency: "Display currency",
    adminKey: "FAL_ADMIN_KEY (cost sync, balance)",
  },
  pipeline: {
    title: "Pipeline (config/pipeline.yaml)",
    keyframeVariants: "Keyframe variants per shot",
    reroll: "Reroll factor (forecast)",
    sheetVariants: "Character sheet variants",
    usdToHkd: "USD → HKD",
  },
  models: {
    title: "Image models (config/models.yaml)",
    description: "The first entry is the default.",
    key: "Key",
    textEndpoint: "Text endpoint",
    editEndpoint: "Edit endpoint (with references)",
    verified: "Verified",
  },
  prices: {
    title: "Prices (config/prices.yaml)",
    check: "Check against fal",
    checking: "Checking…",
    endpoint: "Endpoint",
    ours: "Our price",
    unit: "Unit",
    verified: "Verified",
    falNow: "fal now",
    notFound: "not found",
  },
  set: "set",
  missing: "missing",
  no: "no",
};

export default settings;
