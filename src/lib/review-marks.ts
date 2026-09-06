"use client";

/**
 * Review-marks store. The source of truth is the `review_marks` table in
 * Postgres, reached only through Server Actions. `localStorage`
 * (`dutch:review-marks`) is a first-paint cache so the UI can render marks
 * synchronously before the network round-trip — it is NOT authoritative.
 * `<ReviewMarksHydrator/>` calls `hydrateReviewMarks()` on mount to reconcile
 * the cache with the server (and runs the one-time import of pre-backend
 * local marks).
 */

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
          // Drop pre-Phase-2 mock ids (e.g. `kn_gezellig`) that never
          // round-trip to the server — only real UUIDs are kept.
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

  void toggleReviewMarkAction(knowledgeId)
    .then((result) => {
      if (!result.ok) {
        write(before); // revert
        console.error("toggleReviewMarkAction failed:", result.code, result.message);
      }
    })
    .catch((e) => {
      write(before); // revert — a rejected promise is as much a failure as { ok: false }
      console.error("toggleReviewMarkAction rejected:", e);
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
    if (importResult.data.imported === 0) {
      // `ok` but nothing landed — e.g. a multi-group user hydrating while the
      // active group isn't the marks' origin group, so none of the local ids
      // are live items here. Latching the flag now would let the trailing
      // write(serverMarks) (= write([])) wipe never-persisted local marks.
      // Leave the cache and the flag untouched so a later mount retries.
      console.warn("importLocalReviewMarksAction imported 0 marks; leaving local cache for retry");
      return;
    }
    try {
      window.localStorage.setItem(MIGRATED_KEY, "1");
    } catch {
      /* ignore */
    }
    // Local marks are now authoritative on the server; keep them in the cache.
    return;
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

/**
 * Reactive access to the review-marks cache.
 * @returns a `[marked, toggle]` tuple — `marked` is a `Set<string>` of the
 * currently marked knowledge ids (re-rendered on every change), and `toggle`
 * optimistically flips one id and persists it via the Server Action.
 */
export function useReviewMarks(): [Set<string>, (knowledgeId: string) => void] {
  const marks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback((id: string) => toggleReviewMark(id), []);
  return [marks, toggle];
}
