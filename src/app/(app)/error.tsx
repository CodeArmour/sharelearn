"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-h2 text-fg">Er ging iets mis</h1>
        <p className="text-body text-fg-muted">
          Probeer het opnieuw. Blijft het misgaan, ververs dan de pagina.
        </p>
        <Button onClick={reset}>Opnieuw proberen</Button>
      </div>
    </div>
  );
}
