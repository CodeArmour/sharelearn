import type { ComponentType } from "react";

import type { AvatarCharacterId } from "@/types";

import { BoyFive, BoyFour, BoyOne, BoyThree, BoyTwo } from "./boy-characters";
import { GirlFive, GirlFour, GirlOne, GirlThree, GirlTwo } from "./girl-characters";

export const AVATAR_CHARACTER_COMPONENTS: Record<
  AvatarCharacterId,
  ComponentType<{ className?: string }>
> = {
  "girl-1": GirlOne,
  "girl-2": GirlTwo,
  "girl-3": GirlThree,
  "girl-4": GirlFour,
  "girl-5": GirlFive,
  "boy-1": BoyOne,
  "boy-2": BoyTwo,
  "boy-3": BoyThree,
  "boy-4": BoyFour,
  "boy-5": BoyFive,
};
