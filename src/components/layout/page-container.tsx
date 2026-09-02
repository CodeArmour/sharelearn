import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Horizontal rhythm for page content: centered, max readable width, responsive
 * gutters that match the Figma Main region padding.
 */
export function PageContainer({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-5 py-8 lg:px-12 lg:pt-10 lg:pb-16",
        className,
      )}
      {...props}
    />
  );
}
