// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ActiveContext, GroupSummary } from "./group";

describe("group types", () => {
  it("compiles the discriminated ActiveContext union", () => {
    const a: ActiveContext = { status: "needs-login" };
    const b: ActiveContext = {
      status: "ok",
      user: { id: "u", name: "N", initials: "NN" },
      activeGroup: { id: "g", name: "G", slug: "g" },
      membership: { groupId: "g", userId: "u", role: "owner" },
    };
    const list: GroupSummary[] = [{ id: "g", name: "G", slug: "g", role: "member" }];
    expect([a.status, b.status, list.length]).toEqual(["needs-login", "ok", 1]);
  });
});
