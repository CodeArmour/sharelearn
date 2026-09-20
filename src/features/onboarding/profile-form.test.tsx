import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/server/actions/profile", () => ({
  completeOnboardingAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updateProfileAction: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarConfigSchema } from "@/lib/avatar/schema";
import type { ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

const initial: ProfileFields = {
  fullName: "",
  nickname: "",
  avatar: defaultAvatarFor("user-1"),
  cefrLevel: null,
  learningGoal: null,
};

describe("ProfileForm", () => {
  it("renders required name fields and the avatar builder", () => {
    render(<ProfileForm mode="onboarding" initial={initial} />);
    // Field's required-asterisk suffix (" *") makes the label's accessible
    // text "fullNameLabel *" rather than an exact match — use a regex like
    // the rest of the codebase does for required Field labels (see
    // add-knowledge-view.test.tsx).
    expect(screen.getByLabelText(/fullNameLabel/)).toBeRequired();
    expect(screen.getByLabelText(/nicknameLabel/)).toBeRequired();
    expect(screen.getByRole("group", { name: "groups.hair" })).toBeInTheDocument();
  });

  it("posts the avatar as one JSON field that follows the builder", async () => {
    const { container } = render(<ProfileForm mode="onboarding" initial={initial} />);
    const field = () => container.querySelector<HTMLInputElement>('input[name="avatar"]')!;

    expect(JSON.parse(field().value)).toEqual(initial.avatar);

    await userEvent.click(screen.getByRole("button", { name: /surpriseMe/ }));
    const next = JSON.parse(field().value);
    expect(avatarConfigSchema.safeParse(next).success).toBe(true);
    expect(next).not.toEqual(initial.avatar);
  });

  it("keeps the sticky preview below the app header in edit mode", () => {
    const { container } = render(<ProfileForm mode="edit" initial={initial} />);
    const bar = container.querySelector(".sticky")!;
    expect(bar).toHaveClass("top-[calc(3.5rem+1px+env(safe-area-inset-top))]");
    expect(bar).not.toHaveClass("top-0");
  });

  it("pins the sticky preview at top-0 in onboarding (no header)", () => {
    const { container } = render(<ProfileForm mode="onboarding" initial={initial} />);
    const bar = container.querySelector(".sticky")!;
    expect(bar).toHaveClass("top-0");
  });
});
