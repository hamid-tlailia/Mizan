import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";

// Serverless entry point for Vercel: exports the Express app instead of
// calling app.listen(). The built frontend (dist/public) is served by
// Vercel's static hosting directly; this handles /api and /manus-storage
// only, per the rewrites in vercel.json. See server/_core/index.ts for the
// traditional long-running Node server used outside Vercel.
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
