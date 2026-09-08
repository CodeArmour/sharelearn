import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const sendMagicLink = vi.fn();
const verifyMagicLinkCode = vi.fn();
vi.mock("@/server/actions/auth", () => ({
  sendMagicLink: (...a: unknown[]) => sendMagicLink(...a),
  verifyMagicLinkCode: (...a: unknown[]) => verifyMagicLinkCode(...a),
}));

import messages from "@/messages/en.json";
import { MagicLinkForm } from "./magic-link-form";

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MagicLinkForm />
    </NextIntlClientProvider>,
  );
}

/** Reach the "check your email" state, where the code form lives. */
async function requestLink() {
  sendMagicLink.mockResolvedValue({ ok: true, data: undefined });
  setup();
  await userEvent.type(screen.getByLabelText("Email address"), "me@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
  await screen.findByText("Check your email");
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

describe("MagicLinkForm — code entry", () => {
  it("renders the 6-digit code field in the check-your-email state", async () => {
    await requestLink();
    expect(screen.getByLabelText("Or enter the 6-digit code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify code" })).toBeInTheDocument();
  });

  it("submits the email + code to verifyMagicLinkCode", async () => {
    // On success the real action server-redirects; the mock just resolves ok.
    verifyMagicLinkCode.mockResolvedValue({ ok: true, data: undefined });
    await requestLink();

    await userEvent.type(screen.getByLabelText("Or enter the 6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(verifyMagicLinkCode).toHaveBeenCalledTimes(1);
    const formData = verifyMagicLinkCode.mock.calls[0][1] as FormData;
    expect(formData.get("email")).toBe("me@example.com");
    expect(formData.get("code")).toBe("123456");
    expect(screen.queryByText("That code is wrong or expired.")).not.toBeInTheDocument();
  });

  it("shows an inline error on a bad or expired code", async () => {
    verifyMagicLinkCode.mockResolvedValue({ ok: false, code: "supabase", message: "bad" });
    await requestLink();

    await userEvent.type(screen.getByLabelText("Or enter the 6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByText("That code is wrong or expired.")).toBeInTheDocument();
  });
});
