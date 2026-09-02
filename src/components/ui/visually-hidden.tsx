import type { ComponentPropsWithRef } from "react";

/**
 * Renders content that is available to assistive technology but hidden visually.
 * Use for accessible names that would be redundant on screen.
 */
export function VisuallyHidden(props: ComponentPropsWithRef<"span">) {
  return (
    <span
      {...props}
      className="absolute h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0_0_0_0)]"
    />
  );
}
