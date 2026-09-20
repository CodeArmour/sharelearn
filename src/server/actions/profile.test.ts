// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/server/services/profile-service", () => ({
  completeOnboarding: vi.fn(),
  updateProfileDetails: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";

import { completeOnboardingAction, updateProfileAction } from "./profile";

const avatar = { ...defaultAvatarFor("u1"), glasses: "round" as const };

function form(overrides: Record<string, string | null> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string | null> = {
    fullName: "Jamie Vos",
    nickname: "Jamie",
    avatar: JSON.stringify(avatar),
    cefrLevel: "A2",
    learningGoal: "relocating",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) data.set(key, value);
  }
  return data;
}

const saved = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  avatar,
  cefrLevel: "A2",
  learningGoal: "relocating",
};

describe("updateProfileAction", () => {
  it("saves the structured avatar config posted as JSON", async () => {
    const result = await updateProfileAction(undefined, form());
    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateProfileDetails).toHaveBeenCalledWith(saved);
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("returns a validation error instead of calling the service when the nickname is blank", async () => {
    const result = await updateProfileAction(undefined, form({ nickname: "" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(updateProfileDetails).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["not JSON", "not json"],
    ["an unknown hair style", JSON.stringify({ ...avatar, hair: "nope" })],
    [
      "the legacy shape",
      JSON.stringify({ character: "girl-1", skinColor: "tan", hairColor: "black", shirtColor: "teal", backgroundColor: "cream" }),
    ],
  ])("rejects an avatar that is %s", async (_name, value) => {
    const result = await updateProfileAction(undefined, form({ avatar: value }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(updateProfileDetails).not.toHaveBeenCalled();
  });
});

describe("completeOnboardingAction", () => {
  it("saves the avatar, then redirects to /today", async () => {
    await expect(completeOnboardingAction(undefined, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(completeOnboarding).toHaveBeenCalledWith(saved);
    expect(redirect).toHaveBeenCalledWith("/today");
  });

  it("returns a validation error instead of calling the service when the nickname is blank", async () => {
    const result = await completeOnboardingAction(undefined, form({ nickname: "" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("does not save an invalid avatar", async () => {
    const result = await completeOnboardingAction(undefined, form({ avatar: "not json" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});
