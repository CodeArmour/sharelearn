import Link from "next/link";
import { ArrowRight, ChevronRight, Target } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const container = "rounded-card border border-primary bg-primary-subtle";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/**
 * QuickPracticeCard — the "Snelle oefening" call-to-action at the bottom of
 * Today. Compact tappable card on mobile; icon-well + copy + button on desktop.
 * Maps to the Figma `quick-practice` frames.
 */
export function QuickPracticeCard({
  itemCount,
  questionCount,
  minutes,
}: {
  itemCount: number;
  questionCount: number;
  minutes: number;
}) {
  return (
    <>
      <Link
        href="/practice"
        className={cn(container, focusRing, "flex items-center gap-3 p-4 lg:hidden")}
      >
        <Target className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold text-fg">Snelle oefening</span>
          <span className="text-caption text-fg-secondary">
            {questionCount} vragen · ~{minutes} min
          </span>
        </span>
        <ChevronRight
          className="size-[18px] shrink-0 text-primary"
          strokeWidth={1.75}
          aria-hidden
        />
      </Link>

      <div className={cn(container, "hidden items-center gap-5 px-7 py-6 lg:flex")}>
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
          <Target className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-h3 text-fg">Snelle oefening</span>
          <p className="text-body text-fg-secondary">
            Oefen de {itemCount} dingen die de groep vandaag heeft toegevoegd — {questionCount}{" "}
            vragen, ongeveer {minutes} minuten.
          </p>
        </div>
        <Link href="/practice" className={cn(buttonVariants({ size: "md" }), "shrink-0")}>
          Start oefening
          <ArrowRight className="-mr-0.5 size-[18px]" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </>
  );
}
