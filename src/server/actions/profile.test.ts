// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/profile-service", () => ({
  completeOnboarding: vi.fn(),
  updateProfileDetails: vi.fn(),
}));

import { redirect } from "next/navigation";
import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";

import { completeOnboardingAction, updateProfileAction } from "./profile";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  character: "girl-1",
  skinColor: "tan",
  hairColor: "black",
  shirtColor: "teal",
  backgroundColor: "cream",
};

describe("completeOnboardingAction", () => {
  it("redirects to /today on success", async () => {
    await completeOnboardingAction(undefined, formData(validFields));
    expect(completeOnboarding).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/today");
  });

  it("returns a validation error instead of calling the service when the nickname is blank", async () => {
    const result = await completeOnboardingAction(undefined, formData({ ...validFields, nickname: "" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("updateProfileAction", () => {
  it("saves and returns ok", async () => {
    const result = await updateProfileAction(undefined, formData(validFields));
    expect(updateProfileDetails).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
