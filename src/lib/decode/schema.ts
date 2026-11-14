import { z } from "zod";

export const MAX_MARKDOWN_LENGTH = 20_000;

export const DecodedTokenSchema = z
  .object({
    en: z.string().min(1),
    pl_literal: z.string(),
    grammar: z.string().optional(),
    is_chunk: z.boolean(),
  })
  .strict();

export const DecodedSentenceSchema = z
  .object({
    id: z.string().min(1),
    tokens: z.array(DecodedTokenSchema).min(1),
    natural_pl: z.string(),
  })
  .strict();

export const DecodedBlockSchema = z
  .object({
    type: z.enum(["heading", "paragraph", "list-item"]),
    level: z.number().int().min(1).max(6).optional(),
    sentences: z.array(DecodedSentenceSchema).min(1),
  })
  .strict();

export const DecodedDocumentSchema = z
  .object({
    blocks: z.array(DecodedBlockSchema).min(1),
  })
  .strict();

export const DecodeRequestSchema = z
  .object({
    markdown: z.string().trim().min(1).max(MAX_MARKDOWN_LENGTH),
  })
  .strict();

export type DecodedToken = z.infer<typeof DecodedTokenSchema>;
export type DecodedSentence = z.infer<typeof DecodedSentenceSchema>;
export type DecodedBlock = z.infer<typeof DecodedBlockSchema>;
export type DecodedDocument = z.infer<typeof DecodedDocumentSchema>;

export interface SourceSentence {
  id: string;
  text: string;
}

export interface SourceBlock {
  type: DecodedBlock["type"];
  level?: number;
  sentences: SourceSentence[];
}
