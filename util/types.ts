import { z } from "zod";

export const jsonWebKey = z.object({
  kty: z.string().optional(),
  crv: z.string().optional(),
  key_ops: z.array(z.string()).optional(),
  ext: z.boolean().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
});

export const publicKeychain = z.object({
  encryption: jsonWebKey,
  signing: jsonWebKey,
});

export const encryptedMessage = z.object({
  data: z.array(z.number().int()),
  iv: z.array(z.number().int()),
});

export const signedMessage = z.object({
  data: z.string(),
  signature: z.array(z.number().int()),
});

export type Result<T> = { ok: false; error: string } | ({ ok: true } & T);
