import * as trpc from "@trpc/server";
import routes from "./_routes";

export type Context = {};

export const app = routes;
export type App = typeof app;

export const handler = trpc.createHttpHandler({
  router: app,
  createContext() {
    return {};
  },
});
