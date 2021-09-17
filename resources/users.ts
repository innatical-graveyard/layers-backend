import * as trpc from "@trpc/server";
import { z } from "zod";
import type { Context } from "./_app";
import db from "../util/db";
import { keychainType } from "../util/types";
import jwt from "jsonwebtoken";
import { JWT_KEY } from "../util/constants";
import argon2 from "argon2";

const users = trpc
  .router<Context>()
  .mutation("register", {
    input: z.object({
      username: z.string(),
      email: z.string(),
      token: z.string(),
      keychain: keychainType,
    }),
    async resolve({ input }) {
      const matchingUsername = await db.user.findUnique({
        where: {
          username: input.username,
        },
      });

      if (matchingUsername)
        return {
          ok: false,
          error: "This username is taken",
        };

      const matchingEmail = await db.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (matchingEmail)
        return {
          ok: false,
          error: "This email is in use",
        };

      const user = await db.user.create({
        data: {
          username: input.username,
          hashedToken: await argon2.hash(input.token),
          email: input.email,
          protectedKeychain: input.keychain,
        },
      });

      return {
        ok: true,
        token: jwt.sign({}, JWT_KEY, { expiresIn: "7w", subject: user.id }),
      };
    },
  })
  .mutation("login", {
    input: z.object({
      email: z.string(),
      token: z.string(),
    }),
    async resolve({ input }) {
      const user = await db.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (!user)
        return {
          ok: false,
          error: "User not found",
        };

      if (!(await argon2.verify(user.hashedToken, input.token)))
        return {
          ok: false,
          error: "Invalid Token",
        };

      return {
        ok: true,
        token: jwt.sign({}, JWT_KEY, { expiresIn: "7w", subject: user.id }),
      };
    },
  });

export default users;
