import { EncryptedMessage } from "@innatical/inncryption";
import * as trpc from "@trpc/server";
import { z } from "zod";
import db from "../util/db";
import { encryptedMessage, Result } from "../util/types";
import type { Context } from "./_app";
import jwt from "jsonwebtoken";
import { JWT_KEY } from "../util/constants";
import { channels as channelsBus, MessageEvent } from "../util/bus";

const channels = trpc
  .router<Context>()
  .query("channel", {
    input: z.object({
      id: z.string(),
    }),
    async resolve({
      ctx,
      input,
    }): Promise<Result<{ type: "DM"; id: string; to: string }>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const channel = await db.channel.findUnique({
        where: { id: input.id },
      });

      if (!channel)
        return {
          ok: false,
          error: "ChannelNotFound",
        };

      if (!(channel.fromId === ctx.user.id || channel.toId === ctx.user.id)) {
        return {
          ok: false,
          error: "NoPermission",
        };
      }

      return {
        ok: true,
        type: channel.type,
        id: channel.id,
        to: channel.fromId !== ctx.user.id ? channel.fromId! : channel.toId!,
      };
    },
  })
  .query("messages", {
    input: z.object({
      id: z.string(),
      cursor: z.string().optional(),
    }),
    async resolve({ ctx, input }): Promise<
      Result<{
        messages: {
          id: string;
          createdAt: string;
          updatedAt?: string;
          payload: EncryptedMessage;
          author: string;
        }[];
      }>
    > {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const channel = await db.channel.findUnique({
        where: { id: input.id },
      });

      if (!channel)
        return {
          ok: false,
          error: "ChannelNotFound",
        };

      if (!(channel.fromId === ctx.user.id || channel.toId === ctx.user.id)) {
        return {
          ok: false,
          error: "NoPermission",
        };
      }

      if (input.cursor) {
        const messages = await db.message.findMany({
          take: 25,
          where: {
            channel,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: 1,
          cursor: {
            id: input.cursor,
          },
        });

        return {
          ok: true,
          messages: messages
            .map((message) => ({
              id: message.id,
              createdAt: message.createdAt.toISOString(),
              updatedAt: message.updatedAt?.toISOString(),
              payload: message.payload as unknown as EncryptedMessage,
              author: message.authorId,
            }))
            .reverse(),
        };
      } else {
        const messages = await db.message.findMany({
          take: 25,
          where: {
            channel,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return {
          ok: true,
          messages: messages
            .map((message) => ({
              id: message.id,
              createdAt: message.createdAt.toISOString(),
              updatedAt: message.updatedAt?.toISOString(),
              payload: message.payload as unknown as EncryptedMessage,
              author: message.authorId,
            }))
            .reverse(),
        };
      }
    },
  })
  .mutation("send", {
    input: z.object({
      id: z.string(),
      payload: encryptedMessage,
    }),
    async resolve({ ctx, input }): Promise<Result<{}>> {
      if (!ctx.user)
        return {
          ok: false,
          error: "AuthorizationRequired",
        };

      const channel = await db.channel.findUnique({
        where: { id: input.id },
      });

      if (!channel)
        return {
          ok: false,
          error: "ChannelNotFound",
        };

      if (!(channel.fromId === ctx.user.id || channel.toId === ctx.user.id)) {
        return {
          ok: false,
          error: "NoPermission",
        };
      }

      const message = await db.message.create({
        data: {
          channelId: channel.id,
          authorId: ctx.user.id,
          payload: input.payload,
        },
      });

      await db.channel.update({
        where: {
          id: channel.id,
        },
        data: {
          messages: {
            connect: {
              id: message.id,
            },
          },
        },
      });

      channelsBus.emit(channel.id, {
        type: "message",
        id: message.id,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt?.toISOString(),
        payload: message.payload as unknown as EncryptedMessage,
        author: message.authorId,
      });

      return {
        ok: true,
      };
    },
  })
  .subscription("channel", {
    input: z.object({
      id: z.string(),
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

      const channel = await db.channel.findUnique({
        where: { id: input.id },
      });

      if (!channel)
        throw {
          ok: false,
          error: "ChannelNotFound",
        };

      if (!(channel.fromId === user.id || channel.toId === user.id)) {
        throw {
          ok: false,
          error: "NoPermission",
        };
      }

      return new trpc.Subscription<MessageEvent>((emit) => {
        const onChannelEvent = (e: MessageEvent) => {
          emit.data(e);
        };

        channelsBus.on(channel.id, onChannelEvent);

        return () => {
          channelsBus.off(channel.id, onChannelEvent);
        };
      });
    },
  });

export default channels;
