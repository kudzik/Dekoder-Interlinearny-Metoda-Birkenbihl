import { z } from "zod";

export const MAX_SPEECH_TEXT_LENGTH = 4_000;

export const SpeechRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(MAX_SPEECH_TEXT_LENGTH),
    accent: z.enum(["en-GB", "en-US"]),
  })
  .strict();

export type SpeechAccent = z.infer<typeof SpeechRequestSchema>["accent"];
