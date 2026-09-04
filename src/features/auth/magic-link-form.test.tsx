import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const sendMagicLink = vi.fn();
vi.mock("@/server/actions/auth", () => ({ sendMagicLink: (...a: unknown[]) => sendMagicLink(...a) }));

import messages from "@/messages/en.json";
import { MagicLinkForm } from "./magic-link-form";

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MagicLinkForm />
    </NextIntlClientProvider>,
  );
}

describe("MagicLinkForm", () => {
  it("shows the confirmation state after a successful submit", async () => {
    sendMagicLink.mockResolvedValue({ ok: true, data: undefined });
    setup();
    await userEvent.type(screen.getByLabelText("Email address"), "me@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/me@example.com/)).toBeInTheDocument();
  });

  it("shows an error message when the action fails", async () => {
    sendMagicLink.mockResolvedValue({ ok: false, code: "supabase", message: "nope" });
    setup();
    await userEvent.type(screen.getByLabelText("Email address"), "me@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
    expect(await screen.findByText("Couldn't send the link. Try again.")).toBeInTheDocument();
  });
});
