import type { AvatarConfig } from "./avatar";
import type { CEFRLevel } from "./cefr";

export const LEARNING_GOALS = ["relocating", "work_study", "family", "curious"] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

/** The full set of fields a user fills in during onboarding and can later
 * edit from /profile. */
export interface ProfileFields {
  fullName: string;
  nickname: string;
  avatar: AvatarConfig;
  cefrLevel: CEFRLevel | null;
  learningGoal: LearningGoal | null;
}
