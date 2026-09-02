export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Comma-separated fallback chain, tried in order. When a model's quota or
  // rate limit is hit (HTTP 429), the next one is tried automatically —
  // see invokeWithModelFallback in hadithAnalysis.ts.
  llmModels: (process.env.LLM_MODELS ?? "gpt-5")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean),
};
