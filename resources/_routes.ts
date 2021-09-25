// WARNING: This file is managed by spark, do not modify it!
import channelsRouter from "./channels";
import usersRouter from "./users";
import type { Context } from "./_app";
import * as trpc from "@trpc/server";

export default trpc.router<Context>()
  .merge("users.", usersRouter)
  .merge("channels.", channelsRouter);