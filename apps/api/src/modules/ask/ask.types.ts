import { z } from 'zod';

export const AskBodySchema = z.object({
  question: z.string().trim().min(1).max(2000),
}).strict();

export type AskBody = z.infer<typeof AskBodySchema>;
