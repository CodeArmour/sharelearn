import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { PhotoCapturePanel } from "./photo-capture-panel";

function setup(over: Partial<Parameters<typeof PhotoCapturePanel>[0]> = {}) {
  const props = { onStructure: vi.fn(), busy: false, ...over };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhotoCapturePanel {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

const jpeg = (name = "a.jpg", size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });

describe("PhotoCapturePanel", () => {
  it("disables the submit button until at least one photo is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: "Structure with AI" })).toBeDisabled();
  });

  it("accepts up to 3 photos and passes them to onStructure", async () => {
    const props = setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("a.jpg"), jpeg("b.jpg")]);
    await userEvent.click(screen.getByRole("button", { name: "Structure with AI" }));
    expect(props.onStructure).toHaveBeenCalledWith([expect.any(File), expect.any(File)]);
  });

  it("rejects a 4th photo with a message", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("a"), jpeg("b"), jpeg("c"), jpeg("d")]);
    expect(screen.getByText("Up to 3 photos at a time.")).toBeInTheDocument();
  });

  it("rejects an oversized file", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("big.jpg", 11 * 1024 * 1024)]);
    expect(screen.getByText("That image is over 10 MB.")).toBeInTheDocument();
  });

  it("rejects a non-image file", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [new File(["x"], "notes.txt", { type: "text/plain" })]);
    expect(screen.getByText("Couldn't read that image. Try a JPEG or PNG.")).toBeInTheDocument();
  });
});
