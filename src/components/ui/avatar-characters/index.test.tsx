import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AVATAR_CHARACTERS } from "@/types";

import { AVATAR_CHARACTER_COMPONENTS } from "./index";

describe("AVATAR_CHARACTER_COMPONENTS", () => {
  it("has a component for every character id, each rendering one svg", () => {
    for (const id of AVATAR_CHARACTERS) {
      const Character = AVATAR_CHARACTER_COMPONENTS[id];
      const { container } = render(<Character />);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
    }
  });
});
