import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AvatarConfig } from "@/types";

import { Avatar } from "./avatar";

const config: AvatarConfig = {
  character: "girl-1",
  skinColor: "tan",
  hairColor: "black",
  shirtColor: "teal",
  backgroundColor: "cream",
};

describe("Avatar", () => {
  it("sets the CSS custom properties for the chosen palette", () => {
    const { container } = render(<Avatar avatar={config} />);
    const span = container.querySelector("span")!;
    expect(span.style.getPropertyValue("--avatar-skin")).toBe("#D9A066");
    expect(span.style.getPropertyValue("--avatar-hair")).toBe("#2B2118");
    expect(span.style.getPropertyValue("--avatar-shirt")).toBe("#2F9E8F");
    expect(span.style.getPropertyValue("--avatar-bg")).toBe("#F5EFE6");
    // Note: `container.querySelector('svg[viewBox="0 0 48 48"]')` cannot be used
    // here — jsdom/nwsapi fails to match CSS attribute-value selectors against
    // the SVG `viewBox` attribute (confirmed independent of React/this
    // component: a raw jsdom document with a literal `<svg viewBox="0 0 48
    // 48">` also returns null for that selector, while `getAttribute` and the
    // bare `[viewBox]` existence selector both work). Read the attribute
    // directly instead.
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 48 48");
  });

  it("renders a neutral placeholder when avatar is null", () => {
    const { container } = render(<Avatar avatar={null} aria-label="Jamie" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).not.toBe("0 0 48 48");
    expect(container.querySelector('[aria-label="Jamie"]')).toBeInTheDocument();
  });

  it("renders the same neutral placeholder when the avatar's character id is unknown", () => {
    const { container } = render(
      <Avatar avatar={{ ...config, character: "not-a-real-id" as never }} aria-label="Jamie" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).not.toBe("0 0 48 48");
    expect(container.querySelector('[aria-label="Jamie"]')).toBeInTheDocument();
  });
});
