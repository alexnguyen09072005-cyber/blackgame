import { z } from "zod";

import { interactionSubmissionBaseSchema } from "./schemas";

export type InteractionValidationOptions = {
  allowMixedCases: boolean;
  knownCaseIds?: ReadonlySet<string>;
  enabledCaseIds?: ReadonlySet<string>;
  solvedCaseIds?: ReadonlySet<string>;
};

export function createInteractionSubmissionSchema(
  options: InteractionValidationOptions,
) {
  return interactionSubmissionBaseSchema.superRefine((submission, context) => {
    const itemIds = new Set<string>();
    const caseIds = new Set<string>();

    submission.items.forEach((item, index) => {
      const path = ["items", index] as const;

      if (itemIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mỗi nội dung trong lượt phải có mã riêng.",
          path: [...path, "id"],
        });
      }
      itemIds.add(item.id);
      caseIds.add(item.caseId);

      if (options.knownCaseIds && !options.knownCaseIds.has(item.caseId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Không tìm thấy vụ án.",
          path: [...path, "caseId"],
        });
      } else if (
        options.enabledCaseIds &&
        !options.enabledCaseIds.has(item.caseId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vụ án này đang tạm khóa để kiểm tra nội dung.",
          path: [...path, "caseId"],
        });
      }

      if (options.solvedCaseIds?.has(item.caseId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "OG đã giải vụ án này.",
          path: [...path, "caseId"],
        });
      }
    });

    if (!options.allowMixedCases && caseIds.size > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Các nội dung trong lượt phải thuộc cùng một vụ án.",
        path: ["items"],
      });
    }
  });
}
