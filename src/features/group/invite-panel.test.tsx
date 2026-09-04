import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const inviteMemberAction = vi.fn();
const revokeInvitationAction = vi.fn();
vi.mock("@/server/actions/invites", () => ({
  inviteMemberAction: (...a: unknown[]) => inviteMemberAction(...a),
  revokeInvitationAction: (...a: unknown[]) => revokeInvitationAction(...a),
}));

import messages from "@/messages/en.json";
import type { PendingInvite } from "@/types";

import { InvitePanel } from "./invite-panel";

function setup(pending: PendingInvite[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InvitePanel pendingInvites={pending} />
    </NextIntlClientProvider>,
  );
}

describe("InvitePanel", () => {
  it("shows the empty state", () => {
    setup();
    expect(screen.getByText("No pending invitations.")).toBeInTheDocument();
  });

  it("shows a success message when the invite action succeeds", async () => {
    inviteMemberAction.mockResolvedValue({ ok: true, data: { email: "new@x.com" } });
    setup();
    await userEvent.type(screen.getByLabelText("Email address"), "new@x.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText("Invitation sent to new@x.com.")).toBeInTheDocument();
  });

  it("maps a forbidden error to the not-owner message", async () => {
    inviteMemberAction.mockResolvedValue({ ok: false, code: "forbidden", message: "x" });
    setup();
    await userEvent.type(screen.getByLabelText("Email address"), "x@y.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText("Only an owner can invite members.")).toBeInTheDocument();
  });

  it("renders a revoke button per pending invite", () => {
    setup([
      {
        id: "i1",
        email: "p@x.com",
        role: "member",
        invitedByName: "O",
        expiresAt: "2030-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(screen.getByText("p@x.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });
});
