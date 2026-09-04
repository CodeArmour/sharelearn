import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import messages from "@/messages/en.json";
import { InviteOutcome } from "./invite-outcome";

describe("InviteOutcome", () => {
  it.each([
    ["expired", "This invitation has expired. Ask for a new one."],
    ["revoked", "This invitation was revoked."],
    ["email-mismatch", "This invitation is for a different email. Sign in with that address."],
    ["already-member", "You're already a member of this group."],
    ["not-found", "This invitation link isn't valid."],
  ] as const)("renders the %s message", (code, text) => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <InviteOutcome code={code} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
