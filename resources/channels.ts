import { EncryptedMessage, SignedMessage } from "@innatical/inncryption";
import * as trpc from "@trpc/server";
import { z } from "zod";
import db from "../util/db";
import { Result, signedMessage } from "../util/types";
import type { Context } from "./_app";

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

      if (!(channel.fromId !== ctx.user.id || channel.toId !== ctx.user.id)) {
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
          updatedAt: string | undefined;
          payload: SignedMessage;
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

      if (!(channel.fromId !== ctx.user.id || channel.toId !== ctx.user.id)) {
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
            createdAt: "asc",
          },
          skip: 1,
          cursor: {
            id: input.cursor,
          },
        });

        return {
          ok: true,
          messages: messages.map((message) => ({
            id: message.id,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt?.toISOString(),
            payload: message.payload as unknown as SignedMessage,
            author: message.authorId,
          })),
        };
      } else {
        const messages = await db.message.findMany({
          take: 25,
          where: {
            channel,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        return {
          ok: true,
          messages: messages.map((message) => ({
            id: message.id,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt?.toISOString(),
            payload: message.payload as unknown as SignedMessage,
            author: message.authorId,
          })),
        };
      }
    },
  })
  .mutation("send", {
    input: z.object({
      id: z.string(),
      payload: signedMessage,
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

      if (!(channel.fromId !== ctx.user.id || channel.toId !== ctx.user.id)) {
        return {
          ok: false,
          error: "NoPermission",
        };
      }

      await db.channel.update({
        where: {
          id: channel.id,
        },
        data: {
          messages: {
            create: {
              authorId: ctx.user.id,
              payload: input.payload,
            },
          },
        },
      });

      return {
        ok: true,
      };
    },
  });

export default channels;
