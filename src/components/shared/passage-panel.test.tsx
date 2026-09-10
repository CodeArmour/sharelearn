import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import { PassagePanel } from "./passage-panel";

describe("PassagePanel", () => {
  const passage = { id: "r1", title: "Op de markt", body: "Een tekst over de markt op zaterdag." };

  it("renders the passage title and body", () => {
    render(<PassagePanel passage={passage} />);
    expect(screen.getByText("Op de markt")).toBeInTheDocument();
    expect(screen.getByText("Een tekst over de markt op zaterdag.")).toBeInTheDocument();
  });

  it("exposes the body as a keyboard-scrollable region", () => {
    render(<PassagePanel passage={passage} />);
    const region = screen.getByRole("region", { name: "Op de markt" });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});
