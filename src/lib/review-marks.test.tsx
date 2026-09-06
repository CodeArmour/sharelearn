import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const toggleAction = vi.fn();
const getAction = vi.fn();
const importAction = vi.fn();

vi.mock("@/server/actions/personal", () => ({
  toggleReviewMarkAction: (id: string) => toggleAction(id),
  getReviewMarksAction: () => getAction(),
  importLocalReviewMarksAction: (ids: string[]) => importAction(ids),
}));

import { getReviewMarks, hydrateReviewMarks, useReviewMarks } from "./review-marks";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  window.localStorage.clear();
  toggleAction.mockReset().mockResolvedValue({ ok: true, data: { marked: true } });
  getAction.mockReset().mockResolvedValue({ ok: true, data: [] });
  importAction.mockReset().mockResolvedValue({ ok: true, data: { imported: 0 } });
});

it("reads existing localStorage marks synchronously before hydration", () => {
  window.localStorage.setItem(
    "dutch:review-marks",
    JSON.stringify([{ knowledgeId: A, markedAt: "2026-09-01T00:00:00.000Z" }]),
  );
  const { result } = renderHook(() => useReviewMarks());
  expect(result.current[0].has(A)).toBe(true);
});

it("toggleReviewMark optimistically adds and calls the action", async () => {
  const { result } = renderHook(() => useReviewMarks());
  act(() => result.current[1](B));
  expect(result.current[0].has(B)).toBe(true);
  await waitFor(() => expect(toggleAction).toHaveBeenCalledWith(B));
});

it("reverts the optimistic toggle when the action fails", async () => {
  toggleAction.mockResolvedValue({ ok: false, code: "unknown", message: "x" });
  const { result } = renderHook(() => useReviewMarks());
  act(() => result.current[1](B));
  expect(result.current[0].has(B)).toBe(true);
  await waitFor(() => expect(result.current[0].has(B)).toBe(false));
});

it("hydrate replaces the set with the server's marks", async () => {
  getAction.mockResolvedValue({
    ok: true,
    data: [{ knowledgeId: A, markedAt: "2026-09-01T00:00:00.000Z" }],
  });
  await hydrateReviewMarks();
  expect(getReviewMarks().map((m) => m.knowledgeId)).toEqual([A]);
});

it("runs the one-time import when the server is empty and localStorage has marks", async () => {
  window.localStorage.setItem(
    "dutch:review-marks",
    JSON.stringify([{ knowledgeId: A, markedAt: "2026-09-01T00:00:00.000Z" }]),
  );
  getAction.mockResolvedValue({ ok: true, data: [] });
  importAction.mockResolvedValue({ ok: true, data: { imported: 1 } });
  await hydrateReviewMarks();
  expect(importAction).toHaveBeenCalledWith([A]);
  expect(window.localStorage.getItem("dutch:review-marks-migrated")).toBe("1");
  // does not run a second time
  importAction.mockClear();
  await hydrateReviewMarks();
  expect(importAction).not.toHaveBeenCalled();
});

it("keeps local marks and retries when the one-time import fails", async () => {
  window.localStorage.setItem(
    "dutch:review-marks",
    JSON.stringify([{ knowledgeId: A, markedAt: "2026-09-01T00:00:00.000Z" }]),
  );
  getAction.mockResolvedValue({ ok: true, data: [] });
  importAction.mockResolvedValue({ ok: false, code: "unknown", message: "x" });
  await hydrateReviewMarks();
  // cache is left intact — the failed attempt did not wipe local-only marks
  expect(getReviewMarks().map((m) => m.knowledgeId)).toEqual([A]);
  // the migration flag is NOT set, so it is not permanently disabled
  expect(window.localStorage.getItem("dutch:review-marks-migrated")).toBe(null);
  // the next mount retries the import
  importAction.mockClear();
  await hydrateReviewMarks();
  expect(importAction).toHaveBeenCalledWith([A]);
});
