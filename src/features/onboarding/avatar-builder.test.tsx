import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarConfigSchema } from "@/lib/avatar/schema";
import type { AvatarConfig } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

// Fully explicit so no test below clicks an already-selected radio (which fires
// no change event) and the default has no accessories.
const config: AvatarConfig = {
  ...defaultAvatarFor("user-1"),
  hair: "full",
  hairColor: "black",
  skinColor: "porcelain",
  shirtColor: "teal",
  backgroundColor: "cream",
};

function renderBuilder(value: AvatarConfig = config, stickyTop?: string) {
  const onChange = vi.fn();
  render(<AvatarBuilder value={value} onChange={onChange} stickyTop={stickyTop} />);
  const group = (name: string) => within(screen.getByRole("group", { name }));
  return { onChange, group };
}

describe("AvatarBuilder", () => {
  it("shows a labelled live preview", () => {
    renderBuilder();
    expect(screen.getByRole("img", { name: "preview" })).toBeInTheDocument();
  });

  it("pins the preview bar at top-0 by default", () => {
    const { container } = render(<AvatarBuilder value={config} onChange={vi.fn()} />);
    const bar = container.querySelector(".sticky")!;
    expect(bar).toHaveClass("top-0");
  });

  it("applies stickyTop to the preview bar in place of top-0", () => {
    const { container } = render(
      <AvatarBuilder value={config} onChange={vi.fn()} stickyTop="top-20" />,
    );
    const bar = container.querySelector(".sticky")!;
    expect(bar).toHaveClass("top-20");
    expect(bar).not.toHaveClass("top-0");
  });

  it("exposes each option's label as a tooltip", () => {
    renderBuilder();
    expect(screen.getByTitle("hair.pixie")).toBeInTheDocument();
    expect(screen.getByTitle("glasses.round")).toBeInTheDocument();
  });

  it("zooms accessory thumbnails to the relevant feature but leaves hair tiles whole-head", () => {
    const { group } = renderBuilder();
    const thumbClass = (groupName: string, label: string) =>
      group(groupName)
        .getByRole("radio", { name: label })
        .closest("label")!
        .querySelector("img")!.parentElement!.className;
    expect(thumbClass("groups.glasses", "glasses.round")).toMatch(/scale-\[/);
    expect(thumbClass("groups.earrings", "earrings.hoop")).toMatch(/scale-\[/);
    expect(thumbClass("groups.facialHair", "facialHair.beard")).toMatch(/scale-\[/);
    expect(thumbClass("groups.hair", "hair.pixie")).not.toMatch(/scale-/);
    // The None tile keeps its plain icon, no avatar thumbnail.
    expect(
      group("groups.glasses").getByRole("radio", { name: "none" }).closest("label")!.querySelector("img"),
    ).toBeNull();
  });

  it("offers every choice as a radio in a labelled group, with the current one checked", () => {
    const { group } = renderBuilder();
    expect(group("groups.hair").getAllByRole("radio")).toHaveLength(8);
    expect(group("groups.hair").getByRole("radio", { name: "hair.full" })).toBeChecked();
    expect(group("groups.skinColor").getAllByRole("radio")).toHaveLength(6);
    expect(group("groups.glasses").getByRole("radio", { name: "none" })).toBeChecked();
  });

  it("changes the hairstyle", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.hair").getByRole("radio", { name: "hair.pixie" }));
    expect(onChange).toHaveBeenCalledWith({ ...config, hair: "pixie" });
  });

  it("changes each color independently", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.hairColor").getByRole("radio", { name: "colors.blonde" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, hairColor: "blonde" });
    await userEvent.click(group("groups.skinColor").getByRole("radio", { name: "colors.deep" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, skinColor: "deep" });
    await userEvent.click(group("groups.shirtColor").getByRole("radio", { name: "colors.coral" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, shirtColor: "coral" });
    await userEvent.click(
      group("groups.backgroundColor").getByRole("radio", { name: "colors.lilac" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ ...config, backgroundColor: "lilac" });
  });

  it("adds an accessory", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.glasses").getByRole("radio", { name: "glasses.round" }));
    expect(onChange).toHaveBeenCalledWith({ ...config, glasses: "round" });
  });

  it("removes an accessory with None, leaving the others untouched", async () => {
    const { onChange, group } = renderBuilder({ ...config, glasses: "round", facialHair: "beard" });
    expect(group("groups.glasses").getByRole("radio", { name: "glasses.round" })).toBeChecked();
    await userEvent.click(group("groups.glasses").getByRole("radio", { name: "none" }));
    const next = onChange.mock.calls[0][0] as AvatarConfig;
    expect(next).not.toHaveProperty("glasses");
    expect(next.facialHair).toBe("beard");
  });

  it("Surprise me produces a valid, different avatar", async () => {
    const { onChange } = renderBuilder();
    await userEvent.click(screen.getByRole("button", { name: /surpriseMe/ }));
    const next = onChange.mock.calls[0][0];
    expect(avatarConfigSchema.safeParse(next).success).toBe(true);
    expect(next).not.toEqual(config);
  });

  it("credits Micah under CC BY 4.0", () => {
    renderBuilder();
    expect(screen.getByRole("link", { name: "Micah Lanier" })).toHaveAttribute(
      "href",
      "https://dribbble.com/micahlanier",
    );
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });
});
