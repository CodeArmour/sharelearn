import type { ReactNode } from "react";

import { BrandMark } from "@/components/navigation/brand-mark";

/** Signed-in but no active group — centered, no application shell. */
export default function PickerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
        <BrandMark />
        {children}
      </div>
    </div>
  );
}
