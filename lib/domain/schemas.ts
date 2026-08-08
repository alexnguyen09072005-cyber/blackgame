import { z } from "zod";

import {
  FINAL_ANSWER_MAX_LENGTH,
  GM_NOTE_MAX_LENGTH,
  MAX_INTERACTION_ITEMS,
  MAX_TURN_ITEMS,
  QUESTION_MAX_LENGTH,
} from "../config/game";
import {
  CONFIDENCE_LEVELS,
  INTERACTION_STATUSES,
  VERDICTS,
} from "./types";

export const caseFactSchema = z
  .object({
    id: z.string().trim().min(1),
    text: z.string().trim().min(1),
  })
  .strict();

export const caseDefinitionSchema = z
  .object({
    id: z.string().trim().min(1),
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    difficulty: z.string().trim().min(1),
    publicStory: z.string().trim(),
    coreFacts: z.array(caseFactSchema),
    explicitFalseFacts: z.array(caseFactSchema),
    requiredCoreFacts: z.array(caseFactSchema),
    optionalFacts: z.array(caseFactSchema),
    acceptedAlternatives: z.array(z.string().trim().min(1)),
    irrelevantExamples: z.array(z.string().trim().min(1)),
    unsupportedDetails: z.array(z.string().trim().min(1)),
    needsReview: z.boolean(),
    enabled: z.boolean(),
    reviewNotes: z.array(z.string().trim().min(1)),
  })
  .strict();

export const publicCaseDefinitionSchema = caseDefinitionSchema
  .pick({
    id: true,
    number: true,
    title: true,
    difficulty: true,
    publicStory: true,
    enabled: true,
  })
  .strict();

export const teamDefinitionSchema = z
  .object({
    id: z.string().trim().min(1),
    number: z.number().int().positive(),
    name: z.string().trim().min(1),
    braceletColor: z.string().trim().min(1),
    braceletColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    gmId: z.string().trim().min(1),
  })
  .strict();

export const gameMasterDefinitionSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    codeEnvironmentVariable: z.enum([
      "GM1_CODE",
      "GM2_CODE",
      "GM3_CODE",
    ]),
    teamIds: z.array(z.string().trim().min(1)).length(4),
  })
  .strict();

export const solvedCaseSchema = z
  .object({
    caseId: z.string().trim().min(1),
    solvedAt: z.number().int().nonnegative(),
    interactionId: z.string().trim().min(1),
  })
  .strict();

export const teamStateSchema = z
  .object({
    teamId: z.string().trim().min(1),
    questionCount: z.number().int().nonnegative(),
    turnItemsUsed: z.number().int().min(0).max(MAX_TURN_ITEMS),
    cooldownUntil: z.number().int().nonnegative().nullable(),
    solvedCases: z.array(solvedCaseSchema),
    lastInteractionAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

const itemIdentitySchema = {
  id: z.string().trim().min(1).max(100),
  caseId: z.string().trim().min(1).max(100),
};

export const questionItemSchema = z
  .object({
    ...itemIdentitySchema,
    type: z.literal("QUESTION"),
    content: z
      .string()
      .trim()
      .min(1, "Câu hỏi không được để trống.")
      .max(QUESTION_MAX_LENGTH, "Câu hỏi quá dài."),
  })
  .strict();

export const finalAnswerItemSchema = z
  .object({
    ...itemIdentitySchema,
    type: z.literal("FINAL_ANSWER"),
    content: z
      .string()
      .trim()
      .min(1, "Đáp án cuối không được để trống.")
      .max(FINAL_ANSWER_MAX_LENGTH, "Đáp án cuối quá dài."),
  })
  .strict();

export const interactionItemSchema = z.discriminatedUnion("type", [
  questionItemSchema,
  finalAnswerItemSchema,
]);

export const interactionSubmissionBaseSchema = z
  .object({
    interactionId: z.string().uuid("Mã lượt không hợp lệ."),
    teamId: z.string().trim().min(1, "Không tìm thấy OG."),
    items: z
      .array(interactionItemSchema)
      .min(1, "Mỗi lượt phải có ít nhất một nội dung.")
      .max(
        MAX_INTERACTION_ITEMS,
        "Mỗi lượt chỉ được có tối đa 5 nội dung.",
      ),
  })
  .strict();

const resultIdentitySchema = {
  itemId: z.string().min(1).max(100),
  confidence: z.enum(CONFIDENCE_LEVELS),
  gmNote: z.string().max(GM_NOTE_MAX_LENGTH),
};

export const questionAdjudicationResultSchema = z
  .object({
    ...resultIdentitySchema,
    itemType: z.literal("QUESTION"),
    verdict: z.enum(VERDICTS),
    finalCorrect: z.null(),
  })
  .strict();

export const finalAnswerAdjudicationResultSchema = z
  .object({
    ...resultIdentitySchema,
    itemType: z.literal("FINAL_ANSWER"),
    verdict: z.null(),
    finalCorrect: z.boolean(),
  })
  .strict();

export const adjudicationResultSchema = z.discriminatedUnion("itemType", [
  questionAdjudicationResultSchema,
  finalAnswerAdjudicationResultSchema,
]);

export const adjudicationBatchSchema = z
  .object({
    results: z
      .array(adjudicationResultSchema)
      .min(1)
      .max(MAX_INTERACTION_ITEMS),
  })
  .strict();

export const interactionSchema = z
  .object({
    id: z.string().uuid(),
    gmId: z.string().trim().min(1),
    teamId: z.string().trim().min(1),
    submittedAt: z.number().int().nonnegative(),
    finalizedAt: z.number().int().nonnegative().nullable(),
    status: z.enum(INTERACTION_STATUSES),
    items: z
      .array(interactionItemSchema)
      .min(1)
      .max(MAX_INTERACTION_ITEMS),
    aiResults: z.array(adjudicationResultSchema).nullable(),
    finalResults: z.array(adjudicationResultSchema).nullable(),
    aiError: z.string().nullable(),
    model: z.string().nullable(),
  })
  .strict();
