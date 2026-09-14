import { createRouter, publicQuery } from "./middleware";
import { anoRouter } from "./anotrack";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  ano: anoRouter,
});

export type AppRouter = typeof appRouter;
