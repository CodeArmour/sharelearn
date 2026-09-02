"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CEFRLevel, GroupMemberSummary } from "@/types";
import { cn } from "@/lib/utils/cn";

const pillBase =
  "h-8 rounded-pill border border-border-default bg-surface text-body-sm font-medium text-fg-secondary " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus";

/**
 * Library search + dropdown filters. All state lives in the URL (`q`, `level`,
 * `by`, `sort`) so results are shareable and survive refresh. Changing anything
 * resets pagination.
 */
export function LibraryControls({
  levels,
  members,
}: {
  levels: CEFRLevel[];
  members: GroupMemberSummary[];
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentQ = params.get("q") ?? "";
  const [q, setQ] = useState(currentQ);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    const here = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    if (href === here) return;
    startTransition(() => router.replace(href, { scroll: false }));
  }

  // Debounced search — user typing only, never on mount or on URL sync.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: q.trim() || null }), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-11 items-center gap-2 rounded-lg border border-border-default bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-border-focus">
        <Search className="size-[18px] shrink-0 text-fg-muted" strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-muted"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SelectPill
          label={t("level.label")}
          value={params.get("level") ?? ""}
          onChange={(v) => apply({ level: v || null })}
          options={[
            { value: "", label: t("level.all") },
            ...levels.map((l) => ({ value: l, label: l })),
          ]}
        />
        <SelectPill
          label={t("by.label")}
          value={params.get("by") ?? ""}
          onChange={(v) => apply({ by: v || null })}
          options={[
            { value: "", label: t("by.all") },
            ...members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <SelectPill
          label={t("sort.label")}
          value={params.get("sort") ?? "newest"}
          onChange={(v) => apply({ sort: v === "newest" ? null : v })}
          options={[
            { value: "newest", label: t("sort.newest") },
            { value: "oldest", label: t("sort.oldest") },
            { value: "az", label: t("sort.az") },
          ]}
        />
      </div>
    </div>
  );
}

function SelectPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <span className={cn(pillBase, "relative inline-flex items-center")}>
      <span className="pointer-events-none pl-3 text-fg-muted">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="cursor-pointer appearance-none bg-transparent py-1 pr-7 pl-1.5 outline-none"
      >
        {options.map((o) => (
          <option key={o.value || "_"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-3.5 text-fg-muted"
        strokeWidth={1.75}
        aria-hidden
      />
    </span>
  );
}
