// @vitest-environment node
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { groupMemberships, groups, invitations, profiles } from "./schema";

describe("schema", () => {
  it("defines the four public tables with expected columns", () => {
    expect(getTableConfig(profiles).name).toBe("profiles");
    expect(getTableConfig(groups).columns.map((c) => c.name).sort()).toEqual(
      ["created_at", "created_by", "id", "name", "slug"].sort(),
    );
    const mship = getTableConfig(groupMemberships);
    expect(mship.name).toBe("group_memberships");
    expect(mship.columns.map((c) => c.name)).toContain("role");
    const inv = getTableConfig(invitations).columns.map((c) => c.name);
    expect(inv).toEqual(
      expect.arrayContaining([
        "id", "group_id", "email", "token", "role",
        "invited_by", "status", "expires_at", "accepted_at", "created_at",
      ]),
    );
  });
});
