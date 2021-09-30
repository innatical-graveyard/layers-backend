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
import { EncryptedMessage, SigningPair } from "@innatical/inncryption";
import axios from "axios";
import { UserEvent, users as usersBus } from "../util/bus";

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
      salt: z.array(z.number().int()),
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
          salt: input.salt,
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
        token: jwt.sign({ type: "user" }, JWT_KEY, {
          expiresIn: "7w",
          subject: user.id,
        }),
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
        salt: number[];
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
        salt: user.salt,
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
  .mutation("update", {
    input: z
      .object({
        username: z
          .string()
          .regex(/^[a-zA-Z0-9_]*$/)
          .min(3)
          .max(32),
        email: z.string().email(),
        salt: z.array(z.number().int()),
        avatar: z
          .string()
          .url()
          .regex(/^https:\/\/layers\.fra1\.cdn\.digitaloceanspaces\.com\//),
        encryptedKeychain: encryptedMessage,
        publicKeychain: publicKeychain,
      })
      .partial(),
    async resolve({ input, ctx }): Promise<Result<{}>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      if (input.username) {
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
      }

      if (input.email) {
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
      }

      if (input.avatar) {
        try {
          await axios.head(input.avatar);
        } catch {
          return {
            ok: false,
            error: "InvalidAvatar",
          };
        }
      }

      await db.user.update({
        where: {
          id: ctx.user.id,
        },
        data: input,
      });

      return {
        ok: true,
      };
    },
  })
  .query("getDMChannels", {
    async resolve({ ctx }): Promise<
      Result<{
        channels: {
          id: string;
          to: string;
          lastMessage?: {
            id: string;
            createdAt: string;
            updatedAt?: string;
            payload: EncryptedMessage;
            author: string;
          };
        }[];
      }>
    > {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const channels = await db.channel.findMany({
        where: {
          type: "DM",
          OR: [
            {
              from: {
                id: ctx.user.id,
              },
            },
            {
              to: {
                id: ctx.user.id,
              },
            },
          ],
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

      return {
        ok: true,
        channels: channels.map((channel) => ({
          id: channel.id,
          to: channel.fromId === ctx.user?.id ? channel.toId! : channel.fromId!,
          ...(channel.messages[0]
            ? {
                lastMessage: {
                  id: channel.messages[0].id,
                  createdAt: channel.messages[0].createdAt.toISOString(),
                  updatedAt: channel.messages[0].updatedAt?.toISOString(),
                  payload: channel.messages[0]
                    .payload as unknown as EncryptedMessage,
                  author: channel.messages[0].authorId,
                },
              }
            : {}),
        })),
      };
    },
  })
  .query("friends", {
    async resolve({
      ctx,
    }): Promise<
      Result<{ incoming: string[]; outgoing: string[]; friends: string[] }>
    > {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const user = await db.user.findUnique({
        where: {
          id: ctx.user.id,
        },
        include: {
          friends: true,
          friended: true,
        },
      });

      if (!user)
        return {
          ok: false,
          error: "ThisShouldNeverHappen",
        };

      const outgoing = user.friends.map((friend) => friend.id);
      const incoming = user.friended.map((friend) => friend.id);

      return {
        ok: true,
        friends: outgoing.filter((friend) => incoming.includes(friend)),
        outgoing: outgoing.filter((friend) => !incoming.includes(friend)),
        incoming: incoming.filter((friend) => !outgoing.includes(friend)),
      };
    },
  })
  .mutation("addFriend", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({ ctx, input }): Promise<Result<{}>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const friend = db.user.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!friend)
        return {
          ok: false,
          error: "UserNotFound",
        };

      await db.user.update({
        where: {
          id: ctx.user.id,
        },
        data: {
          friends: {
            connect: {
              id: input.id,
            },
          },
        },
      });

      return {
        ok: true,
      };
    },
  })
  .mutation("removeFriend", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({ ctx, input }): Promise<Result<{}>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const friend = db.user.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!friend)
        return {
          ok: false,
          error: "UserNotFound",
        };

      await db.user.update({
        where: {
          id: ctx.user.id,
        },
        data: {
          friends: {
            disconnect: {
              id: input.id,
            },
          },
          friended: {
            disconnect: {
              id: input.id,
            },
          },
        },
      });

      return {
        ok: true,
      };
    },
  })
  .mutation("getDMChannel", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({ ctx, input }): Promise<Result<{ id: string }>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const recipient = await db.user.findUnique({
        where: {
          id: input.id,
        },
        include: {
          friends: true,
          friended: true,
        },
      });

      if (!recipient)
        return {
          ok: false,
          error: "UserNotFound",
        };

      const outgoing = recipient.friends.map((friend) => friend.id);
      const incoming = recipient.friended.map((friend) => friend.id);

      if (!(outgoing.includes(ctx.user.id) && incoming.includes(ctx.user.id)))
        return {
          ok: false,
          error: "NotFriends",
        };

      const channel = await db.channel.findFirst({
        where: {
          OR: [
            {
              fromId: ctx.user.id,
              toId: recipient.id,
            },
            {
              fromId: recipient.id,
              toId: ctx.user.id,
            },
          ],
        },
      });

      if (!channel) {
        const channel = await db.channel.create({
          data: {
            type: "DM",
            fromId: ctx.user.id,
            toId: recipient.id,
          },
        });

        return {
          ok: true,
          id: channel.id,
        };
      } else {
        return {
          ok: true,
          id: channel.id,
        };
      }
    },
  })
  .subscription("me", {
    input: z.object({
      token: z.string(),
    }),
    async resolve({ input }) {
      const token = jwt.verify(input.token, JWT_KEY) as {
        sub: string;
        type: string;
      };

      if (token.type !== "user") throw new Error("Not a user token");

      const user = await db.user.findUnique({ where: { id: token.sub } });
      if (!user) throw new Error("The user doesn't exist?!?!?!");

      return new trpc.Subscription<UserEvent>((emit) => {
        const onUserEvent = (e: UserEvent) => {
          emit.data(e);
        };

        usersBus.on(user.id, onUserEvent);

        return () => {
          usersBus.off(user.id, onUserEvent);
        };
      });
    },
  });

export default users;
