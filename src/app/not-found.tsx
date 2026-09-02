import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-display text-display text-fg-muted">404</p>
        <h1 className="font-display text-h2 text-fg">Pagina niet gevonden</h1>
        <p className="text-body text-fg-muted">Deze pagina bestaat niet (meer).</p>
        <Link href="/today" className={buttonVariants()}>
          Naar Vandaag
        </Link>
      </div>
    </div>
  );
}
