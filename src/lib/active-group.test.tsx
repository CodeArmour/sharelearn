import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActiveGroupProvider, useActiveGroup } from "./active-group";

function Probe() {
  const { group, membership } = useActiveGroup();
  return (
    <p>
      {group.name}:{membership.role}
    </p>
  );
}

describe("useActiveGroup", () => {
  it("exposes the provided context", () => {
    render(
      <ActiveGroupProvider
        value={{
          user: { id: "u", name: "U", initials: "UU", avatarUrl: null },
          group: { id: "g", name: "Team", slug: "team" },
          membership: { groupId: "g", userId: "u", role: "owner" },
        }}
      >
        <Probe />
      </ActiveGroupProvider>,
    );
    expect(screen.getByText("Team:owner")).toBeInTheDocument();
  });

  it("throws when used outside the provider", () => {
    // Silence the expected React error boundary noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useActiveGroup/);
    spy.mockRestore();
  });
});
