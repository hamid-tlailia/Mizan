import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";

// Source for the Vercel serverless function. Bundled by the "vercel-build"
// script (see package.json + vercel.json) into api/index.mjs — a single
// self-contained file with every relative import inlined — because Vercel's
// own Node builder does not bundle ESM functions (only traces files, and
// requires explicit ".js" extensions on relative imports), which this
// project's TypeScript path aliases and extensionless imports don't satisfy.
// The traditional long-running Node server (server/_core/index.ts) is
// unaffected and still calls app.listen() directly. No "dotenv/config" here:
// Vercel injects env vars into process.env directly (no .env file is
// deployed), and bundling dotenv's CJS internals into this ESM bundle
// crashes at runtime ("Dynamic require of 'fs' is not supported").
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
