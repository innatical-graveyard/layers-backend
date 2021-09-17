import { z } from "zod";

const keypairType = z.object({
  privateKey: z.array(z.number()),
  publicKey: z.array(z.number()),
  salt: z.array(z.number()),
  iv: z.array(z.number()),
});

export const keychainType = z.object({
  encryption: keypairType,
  signing: keypairType,
  tokenSalt: z.array(z.number()),
});

export type Result<T> = { ok: false; error: string } | ({ ok: true } & T);
