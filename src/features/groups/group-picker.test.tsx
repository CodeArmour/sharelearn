import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/groups", () => ({ switchActiveGroupAction: vi.fn() }));

import messages from "@/messages/en.json";
import { GroupPicker } from "./group-picker";

describe("GroupPicker", () => {
  it("renders a submit button per group", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GroupPicker
          groups={[
            { id: "g1", name: "Alpha", slug: "alpha", role: "owner" },
            { id: "g2", name: "Beta", slug: "beta", role: "member" },
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Go to Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Beta" })).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
