"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { ReviewMark } from "@/types";

/**
 * "Marked for review" is personal, per-user state. Until auth + a database
 * exist it lives in `localStorage`; swap `read`/`write` for API calls later and
 * consumers don't change. Kept in sync across every mounted toggle and browser
 * tab via a `storage` event plus a same-tab custom event.
 */

const KEY = "dutch:review-marks";
const EVENT = "dutch:review-marks-change";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(): ReviewMark[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (m): m is ReviewMark =>
            !!m &&
            typeof (m as ReviewMark).knowledgeId === "string" &&
            // Pre-Phase-2 mock ids (e.g. "kn_gezellig") are no longer valid
            // knowledge ids — drop them so stale legacy state self-heals.
            UUID_RE.test((m as ReviewMark).knowledgeId),
        )
      : [];
  } catch {
    return [];
  }
}

function write(marks: ReviewMark[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    /* storage unavailable / full — a no-op is fine in the mock phase */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getReviewMarks(): ReviewMark[] {
  return read();
}

export function toggleReviewMark(knowledgeId: string): void {
  const marks = read();
  const exists = marks.some((m) => m.knowledgeId === knowledgeId);
  write(
    exists
      ? marks.filter((m) => m.knowledgeId !== knowledgeId)
      : [...marks, { knowledgeId, markedAt: new Date().toISOString() }],
  );
}

// --- reactive hook -------------------------------------------------------------

let cachedRaw: string | null = null;
let cachedIds: Set<string> = new Set();

function getSnapshot(): Set<string> {
  const raw = typeof window === "undefined" ? "" : (window.localStorage.getItem(KEY) ?? "");
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = new Set(read().map((m) => m.knowledgeId));
  }
  return cachedIds;
}

const SERVER_SNAPSHOT: Set<string> = new Set();
function getServerSnapshot(): Set<string> {
  return SERVER_SNAPSHOT;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `[markedIds, toggle]` — reactive across every mounted consumer and tab. */
export function useReviewMarks(): [Set<string>, (knowledgeId: string) => void] {
  const marks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback((id: string) => toggleReviewMark(id), []);
  return [marks, toggle];
}
