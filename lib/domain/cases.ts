import type { CaseDefinition, PublicCaseDefinition } from "./types";

/**
 * Keep this serializer as an explicit allowlist. Spreading a CaseDefinition here
 * could expose the secret solution when a field is added later.
 */
export function serializePublicCase(
  caseDefinition: CaseDefinition,
): PublicCaseDefinition {
  return {
    id: caseDefinition.id,
    number: caseDefinition.number,
    title: caseDefinition.title,
    difficulty: caseDefinition.difficulty,
    publicStory: caseDefinition.publicStory,
    enabled: caseDefinition.enabled,
  };
}

export function serializePublicCases(
  cases: readonly CaseDefinition[],
): PublicCaseDefinition[] {
  return cases.map(serializePublicCase);
}
