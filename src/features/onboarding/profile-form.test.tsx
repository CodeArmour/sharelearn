import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/server/actions/profile", () => ({
  completeOnboardingAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updateProfileAction: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import { DEFAULT_AVATAR, type ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

const initial: ProfileFields = {
  fullName: "",
  nickname: "",
  avatar: DEFAULT_AVATAR,
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
    expect(screen.getByLabelText("girl-1")).toBeInTheDocument();
  });
});
