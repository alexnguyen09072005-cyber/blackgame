export const COOLDOWN_SECONDS = 300;
export const COOLDOWN_MS = COOLDOWN_SECONDS * 1_000;

export const MAX_INTERACTION_ITEMS = 5;
export const MAX_TURN_ITEMS = 5;
export const QUESTION_MAX_LENGTH = 300;
export const FINAL_ANSWER_MAX_LENGTH = 1_000;
export const GM_NOTE_MAX_LENGTH = 250;

// OpenAI times out at 20 seconds. After this grace period, an abandoned
// PENDING interaction is marked failed; its AI call is never retried.
export const AI_PENDING_STALE_MS = 35_000;
