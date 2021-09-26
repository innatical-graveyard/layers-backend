import "dotenv/config";
import { User } from "@prisma/client";
import { JWT_KEY } from "../util/constants";
import routes from "./_routes";
import jwt from "jsonwebtoken";
import db from "../util/db";
import { IncomingMessage } from "http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";

export type Context = { user?: User };

export const app = routes;
export type App = typeof app;

export const createContext = async (http: { req: IncomingMessage }) => {
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
};

export const handler = createHTTPHandler({
  router: app,
  createContext,
});

import "../util/ws";
