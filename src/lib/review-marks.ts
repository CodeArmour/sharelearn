"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getReviewMarksAction,
  importLocalReviewMarksAction,
  toggleReviewMarkAction,
} from "@/server/actions/personal";
import type { ReviewMark } from "@/types";

// --- localStorage cache (unchanged) -----------------------------------------
const KEY = "dutch:review-marks";
const MIGRATED_KEY = "dutch:review-marks-migrated";
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
    /* storage unavailable / full */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getReviewMarks(): ReviewMark[] {
  return read();
}

// --- write-through toggle --------------------------------------------------

/** Optimistic: flip the cache immediately, then persist. Revert on failure. */
export function toggleReviewMark(knowledgeId: string): void {
  const before = read();
  const exists = before.some((m) => m.knowledgeId === knowledgeId);
  const optimistic = exists
    ? before.filter((m) => m.knowledgeId !== knowledgeId)
    : [...before, { knowledgeId, markedAt: new Date().toISOString() }];
  write(optimistic);

  void toggleReviewMarkAction(knowledgeId).then((result) => {
    if (!result.ok) {
      write(before); // revert
      console.error("toggleReviewMarkAction failed:", result.code, result.message);
    }
  });
}

// --- hydration + one-time import ----------------------------------------

let hydrating: Promise<void> | null = null;

async function doHydrate(): Promise<void> {
  const serverResult = await getReviewMarksAction();
  if (!serverResult.ok) {
    console.error("getReviewMarksAction failed:", serverResult.code, serverResult.message);
    return;
  }
  const serverMarks = serverResult.data;

  const alreadyMigrated =
    typeof window !== "undefined" && window.localStorage.getItem(MIGRATED_KEY) === "1";
  const localIds = read().map((m) => m.knowledgeId);

  if (serverMarks.length === 0 && localIds.length > 0 && !alreadyMigrated) {
    const importResult = await importLocalReviewMarksAction(localIds);
    if (!importResult.ok) {
      // A failed attempt is not a completed migration: don't set the flag,
      // don't fall through to write([]) — leave the cache for the next mount.
      console.error(
        "importLocalReviewMarksAction failed:",
        importResult.code,
        importResult.message,
      );
      return;
    }
    try {
      window.localStorage.setItem(MIGRATED_KEY, "1");
    } catch {
      /* ignore */
    }
    if (importResult.data.imported > 0) {
      // Local marks are now authoritative on the server; keep them in the cache.
      return;
    }
  }

  write(serverMarks); // server is the source of truth
}

/** Fetch the server's marks into the cache and run the one-time import.
 * Safe to call repeatedly; the network round-trip happens once per mount. */
export function hydrateReviewMarks(): Promise<void> {
  if (!hydrating) {
    hydrating = doHydrate().finally(() => {
      hydrating = null;
    });
  }
  return hydrating;
}

// --- reactive hook (unchanged mechanics) ---------------------------------

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

export function useReviewMarks(): [Set<string>, (knowledgeId: string) => void] {
  const marks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback((id: string) => toggleReviewMark(id), []);
  return [marks, toggle];
}
