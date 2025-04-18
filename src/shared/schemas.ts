import { z } from 'zod';

export const AskPayloadSchema = z.object({
  img: z.string(),
  prompt: z.string(),
  audio: z.string().optional(),
  detail: z.boolean().optional(),
});

export type AskPayload = z.infer<typeof AskPayloadSchema>; 