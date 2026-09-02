import type { ReactNode } from "react";

/** Unauthenticated layout — centered, without the application shell. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-svh place-items-center bg-background p-6">{children}</div>;
}
