// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/repositories/profiles", () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  markOnboarded: vi.fn(),
}));

import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { getProfile, markOnboarded, updateProfile } from "@/server/repositories/profiles";
import { DEFAULT_AVATAR, type ProfileFields } from "@/types";

import { completeOnboarding, getProfileDetails, updateProfileDetails } from "./profile-service";

const fields: ProfileFields = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  avatar: DEFAULT_AVATAR,
  cefrLevel: "A2",
  learningGoal: "relocating",
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", name: "Jamie", avatar: null, avatarUrl: null });
});

describe("completeOnboarding", () => {
  it("saves the fields and marks onboarding complete", async () => {
    await completeOnboarding(fields);
    expect(updateProfile).toHaveBeenCalledWith("u1", fields);
    expect(markOnboarded).toHaveBeenCalledWith("u1");
  });

  it("rejects when signed out", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(completeOnboarding(fields)).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe("updateProfileDetails", () => {
  it("saves the fields without touching onboarding status", async () => {
    await updateProfileDetails(fields);
    expect(updateProfile).toHaveBeenCalledWith("u1", fields);
    expect(markOnboarded).not.toHaveBeenCalled();
  });
});

describe("getProfileDetails", () => {
  it("falls back to the default avatar when none is set", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: "u1",
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar: null,
      cefrLevel: null,
      learningGoal: null,
      onboardedAt: new Date(),
      createdAt: new Date(),
    } as never);
    const details = await getProfileDetails();
    expect(details.avatar).toEqual(DEFAULT_AVATAR);
  });
});
