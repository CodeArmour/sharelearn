import { describe, expect, it, vi } from "vitest";

const set = vi.fn();
const del = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set,
    delete: del,
  }),
}));

import { clearActiveGroupId, writeActiveGroupId } from "./active-group";

describe("active-group cookie writes", () => {
  it("swallow the error thrown when called during a Server Component render", async () => {
    set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });
    del.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });

    await expect(writeActiveGroupId("g1")).resolves.toBeUndefined();
    await expect(clearActiveGroupId()).resolves.toBeUndefined();
  });
});
