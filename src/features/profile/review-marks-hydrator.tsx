"use client";

import { useEffect } from "react";

import { hydrateReviewMarks } from "@/lib/review-marks";

/** Pulls the server's review marks into the client store once per session
 * and runs the one-time localStorage import. Renders nothing. */
export function ReviewMarksHydrator() {
  useEffect(() => {
    void hydrateReviewMarks();
  }, []);
  return null;
}
