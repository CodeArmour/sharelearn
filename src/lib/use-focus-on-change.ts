"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Moves keyboard / screen-reader focus to `ref` whenever `key` changes — but
 * never on the first render. For screens that swap their whole content in place
 * (phase machines, wizard steps) so focus doesn't silently fall back to
 * `<body>` after the element the user activated is unmounted.
 *
 * The target should be programmatically focusable (`tabIndex={-1}`) and usually
 * wants `outline-none`, since the ring on a large container reads as noise.
 */
export function useFocusOnChange(ref: RefObject<HTMLElement | null>, key: unknown): void {
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
  }, [ref, key]);
}
