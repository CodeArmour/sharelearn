import { describe, expect, it } from "vitest";

import { defaultAvatarFor, randomAvatar } from "./generate";
import { avatarConfigSchema } from "./schema";

describe("defaultAvatarFor", () => {
  it("is deterministic for a user id", () => {
    expect(defaultAvatarFor("user-1")).toEqual(defaultAvatarFor("user-1"));
  });

  it("uses the user id as the seed and picks no accessories", () => {
    const avatar = defaultAvatarFor("user-1");
    expect(avatar.seed).toBe("user-1");
    expect(avatar).not.toHaveProperty("glasses");
    expect(avatar).not.toHaveProperty("earrings");
    expect(avatar).not.toHaveProperty("facialHair");
  });

  it("produces a schema-valid config", () => {
    expect(avatarConfigSchema.safeParse(defaultAvatarFor("user-1")).success).toBe(true);
  });

  it("varies between users", () => {
    const distinct = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(defaultAvatarFor(`user-${i}`))),
    );
    expect(distinct.size).toBeGreaterThan(10);
  });
});

describe("randomAvatar", () => {
  it("always produces a schema-valid config", () => {
    for (let i = 0; i < 200; i++) {
      const result = avatarConfigSchema.safeParse(randomAvatar());
      expect(result.success).toBe(true);
    }
  });

  it("can include every accessory", () => {
    const avatar = randomAvatar(() => 0);
    expect(avatar.glasses).toBeDefined();
    expect(avatar.earrings).toBeDefined();
    expect(avatar.facialHair).toBeDefined();
  });

  it("can omit every accessory", () => {
    const avatar = randomAvatar(() => 0.99);
    expect(avatar).not.toHaveProperty("glasses");
    expect(avatar).not.toHaveProperty("earrings");
    expect(avatar).not.toHaveProperty("facialHair");
  });

  it("uses a fresh seed each call", () => {
    expect(randomAvatar().seed).not.toBe(randomAvatar().seed);
  });
});
