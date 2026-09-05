// @vitest-environment node
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { groupMemberships, groups, invitations, knowledgeItems, profiles } from "./schema";

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

describe("knowledgeItems schema", () => {
  it("defines the wide knowledge_items table", () => {
    const cfg = getTableConfig(knowledgeItems);
    expect(cfg.name).toBe("knowledge_items");
    const cols = cfg.columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id", "group_id", "type", "level", "tags", "source", "added_by",
        "created_at", "updated_at",
        "term", "meaning", "part_of_speech", "example", "example_translation",
        "article", "plural", "past_tense", "perfect", "usage_note",
        "title", "summary", "explanation", "examples",
        "body", "word_count", "vocabulary_ids",
      ]),
    );
    expect(cfg.checks.length).toBeGreaterThanOrEqual(5);
  });
});

describe("knowledgeItems edit/delete columns", () => {
  it("has deletedAt and updatedBy", () => {
    const cols = getTableConfig(knowledgeItems).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["deleted_at", "updated_by"]));
  });
});
