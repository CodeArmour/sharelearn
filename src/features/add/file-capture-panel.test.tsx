import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { FileCapturePanel } from "./file-capture-panel";

function setup(over: Partial<Parameters<typeof FileCapturePanel>[0]> = {}) {
  const props = { onStructure: vi.fn(), busy: false, ...over };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FileCapturePanel {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

const jpeg = (name = "a.jpg", size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });

describe("FileCapturePanel", () => {
  it("disables the submit button until at least one file is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: "Structure with AI" })).toBeDisabled();
  });

  it("accepts photos, PDFs, and Excel workbooks", async () => {
    const props = setup();
    const input = screen.getByLabelText("Choose files (up to 3)");
    await userEvent.upload(input, [
      jpeg("notes.jpg"),
      new File(["pdf"], "worksheet.pdf", { type: "application/pdf" }),
      new File(["sheet"], "words.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Structure with AI" }));
    expect(props.onStructure).toHaveBeenCalledWith([
      expect.any(File),
      expect.any(File),
      expect.any(File),
    ]);
  });

  it("rejects a fourth file with a message", async () => {
    setup();
    const input = screen.getByLabelText("Choose files (up to 3)");
    await userEvent.upload(input, [jpeg("a"), jpeg("b"), jpeg("c"), jpeg("d")]);
    expect(screen.getByText("Up to 3 files at a time.")).toBeInTheDocument();
  });

  it("rejects a file larger than the staging bucket allows", async () => {
    setup();
    const input = screen.getByLabelText("Choose files (up to 3)");
    await userEvent.upload(input, [jpeg("big.jpg", 6 * 1024 * 1024)]);
    expect(screen.getByText("That file is over 5 MB.")).toBeInTheDocument();
  });

  it("rejects an unsupported file type", async () => {
    setup();
    const user = userEvent.setup({ applyAccept: false });
    const input = screen.getByLabelText("Choose files (up to 3)");
    await user.upload(input, [new File(["x"], "notes.txt", { type: "text/plain" })]);
    expect(screen.getByText("Choose a photo, PDF, XLS, or XLSX file.")).toBeInTheDocument();
  });
});
