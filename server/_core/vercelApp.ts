import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";

// Source for the Vercel serverless function. Bundled via "pnpm run
// build:vercel" (esbuild --format=cjs) into the committed api/index.cjs — a
// single self-contained CommonJS file with every relative import, path
// alias, and npm dependency inlined. Two things forced CJS specifically
// (not ESM): Vercel's own Node builder doesn't bundle ESM functions at all
// (only traces files, requiring explicit ".js" extensions on relative
// imports — incompatible with this project's path aliases), and even when
// esbuild bundles the CJS dependency tree (express, body-parser, depd, ...)
// into ESM output, Vercel's production Node runtime throws "Dynamic require
// of '<builtin>' is not supported" for their internal require() calls —
// CJS output uses native require() throughout, sidestepping that entirely.
// The traditional long-running Node server (server/_core/index.ts) is
// unaffected and still calls app.listen() directly. No "dotenv/config"
// here: Vercel injects env vars into process.env directly (no .env file is
// deployed).
//
// Regenerate after any change to server-side code:
//   pnpm run build:vercel
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
