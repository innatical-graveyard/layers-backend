import "dotenv/config";
import { User } from "@prisma/client";
import * as trpc from "@trpc/server";
import { JWT_KEY } from "../util/constants";
import routes from "./_routes";
import jwt from "jsonwebtoken";
import db from "../util/db";

export type Context = { user?: User };

export const app = routes;
export type App = typeof app;

export const handler = trpc.createHttpHandler({
  router: app,
  async createContext(http) {
    if (http.req.headers.authorization) {
      const token = jwt.verify(http.req.headers.authorization, JWT_KEY) as {
        sub: string;
        type: string;
      };

      if (token.type !== "user") throw new Error("Not a user token");

      const user = await db.user.findUnique({ where: { id: token.sub } });
      if (!user) throw new Error("The user doesn't exist?!?!?!");

      return {
        user,
      };
    } else return {};
  },
});
