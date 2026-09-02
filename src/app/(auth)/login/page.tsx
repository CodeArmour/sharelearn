import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/navigation/brand-mark";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Inloggen" };

/**
 * Login placeholder. No authentication backend yet — this route exists so the
 * `(auth)` segment and unauthenticated layout are in place. The real form is
 * added when auth is wired up.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
      <BrandMark />
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">Welkom terug</h1>
        <p className="text-body-sm text-fg-muted">
          Log in om verder te gaan met de gedeelde leeromgeving.
        </p>
      </div>
      <Link href="/today" className={buttonVariants({ block: true })}>
        Doorgaan (demo)
      </Link>
      <p className="text-caption text-fg-muted">
        Authenticatie wordt in een latere fase toegevoegd.
      </p>
    </div>
  );
}
