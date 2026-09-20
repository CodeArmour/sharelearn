import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { DEFAULT_AVATAR } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

describe("AvatarBuilder", () => {
  it("calls onChange with the picked character", () => {
    const onChange = vi.fn();
    render(<AvatarBuilder value={DEFAULT_AVATAR} onChange={onChange} />);
    screen.getByLabelText("girl-2").click();
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_AVATAR, character: "girl-2" });
  });

  it("calls onChange with the picked hair color", () => {
    const onChange = vi.fn();
    render(<AvatarBuilder value={DEFAULT_AVATAR} onChange={onChange} />);
    screen.getByLabelText("blonde").click();
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_AVATAR, hairColor: "blonde" });
  });
});
