import * as trpc from "@trpc/server";
import { z } from "zod";
import type { Context } from "./_app";
import db from "../util/db";
import {
  encryptedMessage,
  publicKeychain,
  Result,
  signedMessage,
} from "../util/types";
import jwt from "jsonwebtoken";
import { JWT_KEY } from "../util/constants";
import { randomUUID } from "crypto";
import { SigningPair } from "@innatical/inncryption";

const users = trpc
  .router<Context>()
  .mutation("register", {
    input: z.object({
      username: z
        .string()
        .regex(/^[a-zA-Z0-9_]*$/)
        .min(3)
        .max(32),
      email: z.string().email(),
      token: z.string(),
      encryptedKeychain: encryptedMessage,
      publicKeychain: publicKeychain,
    }),
    async resolve({ input }): Promise<Result<{ token: string }>> {
      const matchingUsername = await db.user.findUnique({
        where: {
          username: input.username,
        },
      });

      if (matchingUsername)
        return {
          ok: false,
          error: "UsernameTaken",
        };

      const matchingEmail = await db.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (matchingEmail)
        return {
          ok: false,
          error: "EmailInUse",
        };

      const user = await db.user.create({
        data: {
          username: input.username,
          email: input.email,
          encryptedKeychain: input.encryptedKeychain,
          publicKeychain: input.publicKeychain,
        },
      });

      return {
        ok: true,
        token: jwt.sign({ type: "user" }, JWT_KEY, {
          expiresIn: "7w",
          subject: user.id,
        }),
      };
    },
  })
  .mutation("login", {
    input: z.object({
      email: z.string().email(),
      signedChallenge: signedMessage,
    }),
    async resolve({ input }): Promise<Result<{ token: string }>> {
      const user = await db.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (!user)
        return {
          ok: false,
          error: "UserNotFound",
        };

      const challenge = await SigningPair.verify(
        input.signedChallenge,
        (user.publicKeychain as z.infer<typeof publicKeychain>).signing
      );

      if (!challenge.ok)
        return {
          ok: false,
          error: "InvalidSignature",
        };

      try {
        const token = jwt.verify(challenge.message as string, JWT_KEY) as {
          sub: string;
        };
        if (token.sub !== user.id)
          return {
            ok: false,
            error: "InvalidToken",
          };
      } catch {
        return {
          ok: false,
          error: "InvalidToken",
        };
      }

      return {
        ok: true,
        token: jwt.sign({}, JWT_KEY, { expiresIn: "7w", subject: user.id }),
      };
    },
  })
  .query("challenge", {
    input: z.object({
      email: z.string().email(),
    }),
    async resolve({ input }): Promise<
      Result<{
        challenge: string;
        encryptedKeychain: z.infer<typeof encryptedMessage>;
      }>
    > {
      const user = await db.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (!user)
        return {
          ok: false,
          error: "UserNotFound",
        };

      return {
        ok: true,
        challenge: jwt.sign({ type: "challenge" }, JWT_KEY, {
          expiresIn: "30s",
          subject: user.id,
          jwtid: randomUUID(),
        }),
        encryptedKeychain: user.encryptedKeychain as z.infer<
          typeof encryptedMessage
        >,
      };
    },
  })
  .query("user", {
    input: z.union([
      z.object({
        id: z.string().uuid(),
      }),
      z.object({
        username: z
          .string()
          .regex(/^[a-zA-Z0-9_]*$/)
          .min(3)
          .max(32),
      }),
    ]),
    async resolve({ input, ctx }): Promise<
      Result<{
        user: {
          id: string;
          username: string;
          publicKeychain: z.infer<typeof publicKeychain>;
          avatar: string;
        };
      }>
    > {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const user = await db.user.findUnique({
        where: {
          ...("id" in input ? { id: input.id } : { username: input.username }),
        },
      });

      if (!user)
        return {
          ok: false,
          error: "UserNotFound",
        };

      return {
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          publicKeychain: user.publicKeychain as z.infer<typeof publicKeychain>,
          avatar: user.avatar,
        },
      };
    },
  })
  .query("me", {
    async resolve({ ctx }): Promise<
      Result<{
        user: {
          id: string;
          username: string;
          publicKeychain: z.infer<typeof publicKeychain>;
          encryptedKeychain: z.infer<typeof encryptedMessage>;
          avatar: string;
          email: string;
        };
      }>
    > {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      return {
        ok: true,
        user: {
          id: ctx.user.id,
          username: ctx.user.username,
          publicKeychain: ctx.user.publicKeychain as z.infer<
            typeof publicKeychain
          >,
          encryptedKeychain: ctx.user.publicKeychain as z.infer<
            typeof encryptedMessage
          >,
          avatar: ctx.user.avatar,
          email: ctx.user.email,
        },
      };
    },
  })
  .query("getDmChannel", {
    input: z.object({}),
    async resolve() {},
  });

export default users;
