import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => {
    const t = (key: string) => (ns ? `${ns}.${key}` : key);
    t.raw = () => [];
    return t;
  },
}));
vi.mock("@/server/actions/practice", () => ({
  generateExamQuestionsAction: vi.fn(),
}));
vi.mock("@/server/actions/personal", () => ({
  recordStudyRunAction: vi.fn().mockResolvedValue({ ok: true }),
}));
// Stub the heavy children so this test is about ExamView's wiring.
vi.mock("@/components/shared", async (orig) => ({
  ...(await orig<typeof import("@/components/shared")>()),
  SetupForm: (props: Record<string, unknown>) => (
    <button type="button" data-variant={props.variant as string} onClick={props.onStart as () => void}>
      start-stub
    </button>
  ),
}));
vi.mock("./exam-session", () => ({
  ExamSession: (props: Record<string, unknown>) => (
    <div data-testid="exam-session" data-length={String(props.length)} data-started={String(props.startedAtMs)} />
  ),
}));
vi.mock("./exam-results", () => ({ ExamResults: () => <div data-testid="exam-results" /> }));

import { generateExamQuestionsAction } from "@/server/actions/practice";

import { ExamView } from "./exam-view";

const addSpy = vi.spyOn(window, "addEventListener");
const removeSpy = vi.spyOn(window, "removeEventListener");

beforeEach(() => {
  addSpy.mockClear();
  removeSpy.mockClear();
  vi.mocked(generateExamQuestionsAction).mockResolvedValue({
    ok: true,
    data: [
      { id: "q1", knowledgeId: "q1", knowledgeType: "vocabulary", instructionKey: "meaningOf", prompt: "p", options: ["a", "b"], correctIndex: 0 },
    ],
  } as never);
});
afterEach(() => vi.clearAllMocks());

describe("ExamView", () => {
  it("gives SetupForm the exam variant", async () => {
    render(<ExamView levels={["A1", "B1"]} />);
    expect(await screen.findByText("start-stub")).toHaveAttribute("data-variant", "exam");
  });

  it("enters the session with a timer length and attaches a beforeunload guard", async () => {
    render(<ExamView levels={["A1", "B1"]} />);
    await waitFor(() => expect(generateExamQuestionsAction).toHaveBeenCalled());

    fireEvent.click(screen.getByText("start-stub"));

    const session = await screen.findByTestId("exam-session");
    expect(session).toHaveAttribute("data-length", "20");
    expect(session.getAttribute("data-started")).not.toBe("null");
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
