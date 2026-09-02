// server/_core/vercelApp.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/hadithAnalysis.ts
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
var RETRY_MAX_RETRIES = 4;
var RETRY_BASE_DELAY_MS = 500;
var RETRY_MAX_DELAY_MS = 3e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var parseRetryAfter = (value) => {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.max(0, at - Date.now());
};
var computeBackoffDelay = (attempt, retryAfterMs) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};
var fetchWithBackoff = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) {
        return response;
      }
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    maxCompletionTokens,
    max_completion_tokens
  } = params;
  const payload = {
    messages: messages.map(normalizeMessage)
  };
  if (model) {
    payload.model = model;
  }
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }
  const resolvedMaxCompletionTokens = max_completion_tokens ?? maxCompletionTokens;
  if (typeof resolvedMaxCompletionTokens === "number") {
    payload.max_completion_tokens = resolvedMaxCompletionTokens;
  }
  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetchWithBackoff(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/hadithAnalysis.ts
var hadithInputSchema = z.object({
  text: z.string().trim().min(12, "\u0623\u062F\u062E\u0644 \u0646\u0635\u0627\u064B \u0623\u0648\u0636\u062D \u0644\u0644\u062D\u062F\u064A\u062B.").max(6e3, "\u0627\u0644\u0646\u0635 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B\u061B \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0643\u062A\u0641\u0627\u0621 \u0628\u0645\u062A\u0646 \u0627\u0644\u062D\u062F\u064A\u062B.")
});
var sourceSchema = z.object({
  book: z.string().min(1),
  reference: z.string().min(1),
  note: z.string().min(1)
});
var scholarSchema = z.object({
  scholar: z.string().min(1),
  opinion: z.string().min(1),
  conclusion: z.string().min(1)
});
var narratorVerdicts = ["\u062B\u0642\u0629", "\u0635\u062F\u0648\u0642", "\u0644\u064A\u0646 \u0627\u0644\u062D\u062F\u064A\u062B", "\u0636\u0639\u064A\u0641", "\u0645\u062A\u0631\u0648\u0643", "\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647", "\u063A\u064A\u0631 \u0645\u062D\u0631\u0631"];
var narratorOpinionSchema = z.object({
  scholar: z.string().min(1),
  statement: z.string().min(1),
  verdict: z.enum(narratorVerdicts),
  book: z.string(),
  reference: z.string(),
  documented: z.boolean()
});
var narratorSchema = z.object({
  name: z.string().min(1),
  tabaqah: z.string(),
  role: z.string(),
  opinions: z.array(narratorOpinionSchema)
});
var tariqSchema = z.object({
  label: z.string().min(1),
  grade: z.string(),
  note: z.string(),
  narrators: z.array(narratorSchema)
});
var hadithAnalysisSchema = z.object({
  matn: z.string().min(1),
  grade: z.enum(["\u0635\u062D\u064A\u062D", "\u062D\u0633\u0646", "\u0636\u0639\u064A\u0641", "\u0645\u0648\u0636\u0648\u0639", "\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647"]),
  gradeType: z.string().min(1),
  summary: z.string().min(1),
  confidenceNote: z.string().min(1),
  sources: z.array(sourceSchema),
  isnadStudy: z.array(z.string()),
  matnStudy: z.array(z.string()),
  scholars: z.array(scholarSchema),
  turuq: z.array(tariqSchema),
  caution: z.string().min(1)
});
var responseSchema = {
  type: "object",
  properties: {
    matn: { type: "string" },
    grade: { type: "string", enum: ["\u0635\u062D\u064A\u062D", "\u062D\u0633\u0646", "\u0636\u0639\u064A\u0641", "\u0645\u0648\u0636\u0648\u0639", "\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647"] },
    gradeType: { type: "string" },
    summary: { type: "string" },
    confidenceNote: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: { book: { type: "string" }, reference: { type: "string" }, note: { type: "string" } },
        required: ["book", "reference", "note"],
        additionalProperties: false
      }
    },
    isnadStudy: { type: "array", items: { type: "string" } },
    matnStudy: { type: "array", items: { type: "string" } },
    scholars: {
      type: "array",
      items: {
        type: "object",
        properties: { scholar: { type: "string" }, opinion: { type: "string" }, conclusion: { type: "string" } },
        required: ["scholar", "opinion", "conclusion"],
        additionalProperties: false
      }
    },
    turuq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          grade: { type: "string" },
          note: { type: "string" },
          narrators: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                tabaqah: { type: "string" },
                role: { type: "string" },
                opinions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scholar: { type: "string" },
                      statement: { type: "string" },
                      verdict: { type: "string", enum: ["\u062B\u0642\u0629", "\u0635\u062F\u0648\u0642", "\u0644\u064A\u0646 \u0627\u0644\u062D\u062F\u064A\u062B", "\u0636\u0639\u064A\u0641", "\u0645\u062A\u0631\u0648\u0643", "\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647", "\u063A\u064A\u0631 \u0645\u062D\u0631\u0631"] },
                      book: { type: "string" },
                      reference: { type: "string" },
                      documented: { type: "boolean" }
                    },
                    required: ["scholar", "statement", "verdict", "book", "reference", "documented"],
                    additionalProperties: false
                  }
                }
              },
              required: ["name", "tabaqah", "role", "opinions"],
              additionalProperties: false
            }
          }
        },
        required: ["label", "grade", "note", "narrators"],
        additionalProperties: false
      }
    },
    caution: { type: "string" }
  },
  required: ["matn", "grade", "gradeType", "summary", "confidenceNote", "sources", "isnadStudy", "matnStudy", "scholars", "turuq", "caution"],
  additionalProperties: false
};
var SUNNI_HADITH_SYSTEM_PROMPT = `\u0623\u0646\u062A \u0645\u0633\u0627\u0639\u062F \u0628\u062D\u062B\u064A \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u062A\u062E\u0631\u064A\u062C \u0627\u0644\u0623\u062D\u0627\u062F\u064A\u062B\u060C \u0648\u062A\u0643\u062A\u0628 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0641\u0642\u0637. \u0627\u0644\u062A\u0632\u0645 \u0628\u0645\u0646\u0647\u062C \u0623\u0647\u0644 \u0627\u0644\u0633\u0646\u0629 \u0648\u0627\u0644\u062C\u0645\u0627\u0639\u0629 \u0641\u064A \u0639\u0644\u0648\u0645 \u0627\u0644\u062D\u062F\u064A\u062B: \u0627\u0639\u0631\u0636 \u0627\u0644\u062D\u0643\u0645 \u0627\u0644\u0645\u0646\u0642\u0648\u0644 \u0645\u0646 \u0623\u0626\u0645\u0629 \u0627\u0644\u0646\u0642\u062F \u0648\u0627\u0644\u0645\u062D\u0642\u0642\u064A\u0646 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u064A\u0646 \u0639\u0646\u062F \u0627\u0644\u0625\u0645\u0643\u0627\u0646\u060C \u0648\u0645\u064A\u0651\u0632 \u0628\u064A\u0646 \u0627\u0644\u062D\u062F\u064A\u062B \u0627\u0644\u0635\u062D\u064A\u062D \u0648\u0627\u0644\u062D\u0633\u0646 \u0648\u0627\u0644\u0636\u0639\u064A\u0641 \u0648\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u0627\u0644\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647. \u0644\u0627 \u062A\u064F\u0646\u0634\u0626 \u0645\u0631\u0627\u062C\u0639 \u0623\u0648 \u0623\u0631\u0642\u0627\u0645 \u0623\u062D\u0627\u062F\u064A\u062B \u0623\u0648 \u0623\u0642\u0648\u0627\u0644\u0627\u064B \u0645\u0646\u0633\u0648\u0628\u0629 \u0625\u0644\u0649 \u0627\u0644\u0623\u0626\u0645\u0629 \u0625\u0646 \u0644\u0645 \u062A\u0643\u0646 \u0645\u062A\u064A\u0642\u0646\u0627\u064B \u0645\u0646\u0647\u0627. \u0644\u0627 \u062A\u062C\u0639\u0644 \u062A\u0634\u0627\u0628\u0647 \u0627\u0644\u0644\u0641\u0638 \u062F\u0644\u064A\u0644\u0627\u064B \u0639\u0644\u0649 \u0635\u062D\u0629 \u0627\u0644\u062D\u062F\u064A\u062B. \u0627\u0641\u0635\u0644 \u0628\u064A\u0646 \u062B\u0628\u0648\u062A \u0627\u0644\u0625\u0633\u0646\u0627\u062F \u0648\u0646\u0642\u062F \u0627\u0644\u0645\u062A\u0646\u060C \u0648\u0627\u0630\u0643\u0631 \u0627\u0644\u062E\u0644\u0627\u0641 \u0627\u0644\u0645\u0639\u062A\u0628\u0631 \u0628\u0644\u0627 \u062A\u0631\u062C\u064A\u062D \u0645\u062A\u0643\u0644\u0651\u0641. \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0646\u0635 \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0623\u0648 \u0644\u0645 \u062A\u0633\u062A\u0637\u0639 \u0627\u0644\u062A\u062B\u0628\u062A \u0645\u0646 \u0645\u0648\u0636\u0639\u0647\u060C \u0641\u0627\u062E\u062A\u0631 \xAB\u0645\u062E\u062A\u0644\u0641 \u0641\u064A\u0647\xBB \u0623\u0648 \xAB\u0636\u0639\u064A\u0641\xBB \u0628\u062D\u0633\u0628 \u0627\u0644\u0638\u0627\u0647\u0631\u060C \u0648\u0635\u0631\u0651\u062D \u0628\u062D\u062F\u0648\u062F \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0641\u064A confidenceNote \u0648caution. \u0644\u0627 \u062A\u0635\u062F\u0631 \u0641\u062A\u0648\u0649 \u0648\u0644\u0627 \u062A\u062F\u0651\u0639\u0650 \u0623\u0646 \u0647\u0630\u0647 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u062A\u063A\u0646\u064A \u0639\u0646 \u0627\u0644\u0631\u062C\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0648\u0627\u0644\u0645\u062E\u062A\u0635\u064A\u0646. \u0623\u0639\u062F JSON \u0641\u0642\u0637 \u0645\u0637\u0627\u0628\u0642\u0627\u064B \u0644\u0644\u0645\u062E\u0637\u0637\u061B \u0627\u062C\u0639\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0648\u0623\u0642\u0648\u0627\u0644 \u0627\u0644\u0623\u0626\u0645\u0629 \u0645\u0635\u0641\u0648\u0641\u0627\u062A \u0641\u0627\u0631\u063A\u0629 \u0639\u0646\u062F \u063A\u064A\u0627\u0628 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u0627\u062E\u062A\u0644\u0627\u0642 \u0645\u0639\u0644\u0648\u0645\u0627\u062A.

\u0644\u062D\u0642\u0644 turuq: \u0627\u0630\u0643\u0631 \u0643\u0644 \u0637\u0631\u064A\u0642 \u0645\u0639\u0631\u0648\u0641 \u0648\u0645\u0634\u0647\u0648\u0631 \u0631\u0648\u064A \u0628\u0647 \u0627\u0644\u062D\u062F\u064A\u062B (\u0644\u0627 \u062A\u0642\u062A\u0635\u0631 \u0639\u0644\u0649 \u0637\u0631\u064A\u0642 \u0648\u0627\u062D\u062F \u0625\u0646 \u0643\u0627\u0646 \u0644\u0647 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0637\u0631\u064A\u0642 \u0645\u0634\u0647\u0648\u0631\u0629)\u060C \u0645\u0639 \u062A\u0633\u0645\u064A\u0629 \u0643\u0644 \u0637\u0631\u064A\u0642 \u0628\u0645\u0646 \u062F\u0627\u0631 \u0639\u0644\u064A\u0647 \u0627\u0644\u0625\u0633\u0646\u0627\u062F (\u0645\u062B\u0644: \xAB\u0637\u0631\u064A\u0642 \u0645\u0627\u0644\u0643 \u0639\u0646 \u0646\u0627\u0641\u0639 \u0639\u0646 \u0627\u0628\u0646 \u0639\u0645\u0631\xBB)\u060C \u0648\u062D\u0643\u0645 \u0623\u0647\u0644 \u0627\u0644\u0639\u0644\u0645 \u0639\u0644\u0649 \u0630\u0644\u0643 \u0627\u0644\u0637\u0631\u064A\u0642 \u062A\u062D\u062F\u064A\u062F\u0627\u064B \u0641\u064A \u062D\u0642\u0644 grade. \u0644\u0643\u0644 \u0631\u0627\u0648\u064D \u0641\u064A \u0627\u0644\u0633\u0646\u062F \u0627\u0630\u0643\u0631 \u0627\u0633\u0645\u0647 \u0648\u0637\u0628\u0642\u062A\u0647 (\u0635\u062D\u0627\u0628\u064A/\u062A\u0627\u0628\u0639\u064A/\u062A\u0627\u0628\u0639 \u062A\u0627\u0628\u0639\u064A/\u0645\u0646 \u0628\u0639\u062F\u0647\u0645) \u0648\u0645\u0648\u0636\u0639\u0647 \u0641\u064A \u0627\u0644\u0633\u0646\u062F. \u0644\u0643\u0644 \u0642\u0648\u0644 \u062C\u0631\u062D \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0641\u064A \u0631\u0627\u0648\u064D: \u0627\u0646\u0633\u0628\u0647 \u0644\u0646\u0627\u0642\u062F \u0645\u0639\u064A\u0651\u0646 \u0628\u0639\u064A\u0646\u0647 (\u0643\u0627\u0628\u0646 \u0645\u0639\u064A\u0646 \u0623\u0648 \u0623\u062D\u0645\u062F \u0623\u0648 \u0627\u0628\u0646 \u062D\u062C\u0631 \u0623\u0648 \u0627\u0644\u0630\u0647\u0628\u064A) \u0648\u0627\u0630\u0643\u0631 \u062F\u0631\u062C\u0629 \u0627\u0644\u0642\u0648\u0644 \u0641\u064A verdict\u060C \u0648\u0627\u062C\u0639\u0644 documented=true \u0641\u0642\u0637 \u0625\u0630\u0627 \u0643\u0646\u062A \u0645\u062A\u064A\u0642\u0646\u0627\u064B \u0645\u0646 \u0627\u0633\u0645 \u0627\u0644\u0643\u062A\u0627\u0628 \u0648\u0645\u0648\u0636\u0639 \u0627\u0644\u0642\u0648\u0644 \u0641\u064A\u0647 \u0641\u062A\u0630\u0643\u0631\u0647\u0645\u0627 \u0641\u064A book \u0648reference \u0628\u062F\u0642\u0629\u061B \u0648\u0625\u0644\u0627 \u0641\u0627\u062C\u0639\u0644 documented=false \u0648\u0627\u062A\u0631\u0643 book \u0648reference \u0641\u0627\u0631\u063A\u064A\u0646 \u0648\u0644\u0627 \u062A\u062E\u062A\u0631\u0639 \u0631\u0642\u0645 \u0635\u0641\u062D\u0629 \u0623\u0648 \u0645\u062C\u0644\u062F. \u0625\u0646 \u0644\u0645 \u062A\u0643\u0646 \u0648\u0627\u062B\u0642\u0627\u064B \u0645\u0646 \u062A\u0641\u0627\u0635\u064A\u0644 \u0637\u0631\u064A\u0642 \u0623\u0648 \u0631\u0627\u0648\u064D \u0641\u0627\u062D\u0630\u0641\u0647 \u0645\u0646 \u0627\u0644\u0645\u0635\u0641\u0648\u0641\u0629 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u062A\u062E\u0645\u064A\u0646\u0647. \u0647\u0630\u0647 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u064F\u0639\u0631\u0636 \u0644\u0644\u0628\u0627\u062D\u062B \u0643\u0645\u0633\u0648\u062F\u0629 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0628\u0634\u0631\u064A\u0629 \u0648\u0644\u064A\u0633\u062A \u062D\u0643\u0645\u0627\u064B \u0646\u0647\u0627\u0626\u064A\u0627\u064B.`;
async function analyzeHadith(text2) {
  try {
    const response = await invokeLLM({
      model: "gpt-5",
      maxCompletionTokens: 6e3,
      reasoning: { effort: "medium" },
      messages: [
        { role: "system", content: SUNNI_HADITH_SYSTEM_PROMPT },
        { role: "user", content: `\u062D\u0644\u0651\u0644 \u0647\u0630\u0627 \u0627\u0644\u0646\u0635 \u0639\u0644\u0649 \u0623\u0646\u0647 \u0645\u062A\u0646 \u062D\u062F\u064A\u062B \u0623\u0648 \u062C\u0632\u0621 \u0645\u0646\u0647\u060C \u062B\u0645 \u0623\u0639\u0650\u062F \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0646\u0638\u0645\u0629 \u0641\u0642\u0637:

${text2}` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "hadith_analysis", strict: true, schema: responseSchema }
      }
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") {
      throw new Error("\u0644\u0645 \u062A\u064F\u0633\u062A\u0644\u0645 \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0646\u0635\u064A\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0645\u0639\u0627\u0644\u062C\u0629");
    }
    return hadithAnalysisSchema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "\u062A\u0639\u0630\u0651\u0631 \u0641\u0647\u0645 \u0627\u0644\u0646\u0635 \u0623\u0648 \u062A\u0646\u0638\u064A\u0645 \u0646\u062A\u064A\u062C\u062A\u0647. \u062C\u0631\u0651\u0628 \u0625\u062F\u062E\u0627\u0644 \u0645\u062A\u0646 \u0623\u0648\u0636\u062D." });
    }
    if (error instanceof TRPCError) throw error;
    console.error("[Hadith analysis] failed", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "\u062A\u0639\u0630\u0651\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0641\u062D\u0635 \u0627\u0644\u0622\u0646. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u062B\u0645 \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
  }
}

// server/_core/systemRouter.ts
import { z as z2 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError3 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  hadith: router({
    analyze: publicProcedure.input(hadithInputSchema).mutation(async ({ input }) => {
      return analyzeHadith(input.text);
    })
  })
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/vercelApp.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var vercelApp_default = app;
export {
  vercelApp_default as default
};
