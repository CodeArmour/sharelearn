import { useTranslations } from "next-intl";

import type { PracticeScope, PracticeSetup } from "@/types";
import { Button, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const MODES = ["vocabulary", "grammar", "reading", "mixed"] as const;
const LENGTHS = [
  { key: "ten", value: 10 },
  { key: "twenty", value: 20 },
  { key: "all", value: 0 },
] as const;

const segment = (active: boolean) =>
  cn(
    "rounded-sm px-3 py-1.5 text-body-sm font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
    active ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
  );

/**
 * Shared Setup form for Practice and Exam: pick mode, scope (+ level) and
 * length; shows a live question count and disables Start when nothing matches.
 * Labels come from `practice.setup.*`; the caller supplies the Start label.
 */
export function SetupForm({
  setup,
  levels,
  count,
  startLabel,
  accent,
  filterSummary,
  onChange,
  onStart,
}: {
  setup: PracticeSetup;
  levels: string[];
  count: number;
  startLabel: string;
  /** Recolours the Start button — Exam passes `"warning"`; Practice keeps primary. */
  accent?: "warning";
  /** One-line description of a carried Library filter; enables the "custom" scope. */
  filterSummary?: string;
  onChange: (patch: Partial<PracticeSetup>) => void;
  onStart: () => void;
}) {
  const t = useTranslations("practice.setup");
  const isCustom = setup.scope === "custom";

  const modeLabel = {
    vocabulary: t("mode.vocabulary"),
    grammar: t("mode.grammar"),
    reading: t("mode.reading"),
    mixed: t("mode.mixed"),
  };
  const lengthLabel = {
    ten: t("length.ten"),
    twenty: t("length.twenty"),
    all: t("length.all"),
  };

  return (
    <div className="flex flex-col gap-6">
      {isCustom ? null : (
        <div className="flex flex-col gap-2">
          <span className="text-label font-medium text-fg-secondary">{t("modeLabel")}</span>
          <div
            role="group"
            aria-label={t("modeLabel")}
            className="flex flex-wrap gap-0.5 self-start rounded-md bg-surface-sunken p-0.5"
          >
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={setup.mode === m}
                onClick={() => onChange({ mode: m })}
                className={segment(setup.mode === m)}
              >
                {modeLabel[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("scopeLabel")} htmlFor="setup-scope">
          <Select
            id="setup-scope"
            value={setup.scope}
            onChange={(e) => {
              const scope = e.target.value as PracticeScope;
              onChange(scope === "level" ? { scope, level: setup.level ?? levels[0] } : { scope });
            }}
          >
            {filterSummary ? <option value="custom">{t("scope.custom")}</option> : null}
            <option value="all">{t("scope.all")}</option>
            <option value="today">{t("scope.today")}</option>
            <option value="review">{t("scope.review")}</option>
            {levels.length > 0 ? <option value="level">{t("scope.level")}</option> : null}
          </Select>
        </Field>

        {setup.scope === "level" ? (
          <Field label={t("levelLabel")} htmlFor="setup-level">
            <Select
              id="setup-level"
              value={setup.level ?? levels[0]}
              onChange={(e) => onChange({ level: e.target.value })}
            >
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      {isCustom && filterSummary ? (
        <p className="-mt-3 text-body-sm text-fg-muted">{filterSummary}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-fg-secondary">{t("lengthLabel")}</span>
        <div
          role="group"
          aria-label={t("lengthLabel")}
          className="flex flex-wrap gap-0.5 self-start rounded-md bg-surface-sunken p-0.5"
        >
          {LENGTHS.map(({ key, value }) => (
            <button
              key={key}
              type="button"
              aria-pressed={setup.length === value}
              onClick={() => onChange({ length: value })}
              className={segment(setup.length === value)}
            >
              {lengthLabel[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="button" size="md" tone={accent} onClick={onStart} disabled={count === 0}>
          {startLabel}
        </Button>
        <p className="text-body-sm text-fg-muted">
          {count === 0 ? t("notEnough") : t("count", { count })}
        </p>
      </div>
    </div>
  );
}
