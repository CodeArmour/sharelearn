import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarDataUri } from "@/lib/avatar/micah";

import { Avatar } from "./avatar";

const config = { ...defaultAvatarFor("user-1"), glasses: "round" as const };

describe("Avatar", () => {
  it("renders the saved config as a local SVG data-URI image", () => {
    const { container } = render(<Avatar avatar={config} />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(avatarDataUri(config));
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(img).toHaveAttribute("alt", "");
  });

  it("is decorative unless it has a label", () => {
    const { container } = render(<Avatar avatar={config} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes an image role and label when it stands alone", () => {
    const { getByRole } = render(<Avatar avatar={config} aria-label="Jamie" />);
    expect(getByRole("img", { name: "Jamie" })).toBeInTheDocument();
  });

  it("renders a neutral placeholder (no image) when avatar is null", () => {
    const { container, getByLabelText } = render(<Avatar avatar={null} aria-label="Jamie" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(getByLabelText("Jamie")).toBeInTheDocument();
  });

  it("supports the xl preview size", () => {
    const { container } = render(<Avatar avatar={config} size="xl" />);
    expect(container.firstElementChild).toHaveClass("md:size-32");
  });
});
