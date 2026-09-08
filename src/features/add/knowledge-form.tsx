import type { Dispatch, FormEvent, ReactNode, RefObject, SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { CEFR_LEVELS } from "@/types";
import { Button, Field, Input, Select } from "@/components/ui";

import { GrammarFields } from "./grammar-fields";
import { NoteFields } from "./note-fields";
import { ReadingFields } from "./reading-fields";
import { TypePicker } from "./type-picker";
import type { Errors, Example, PickerType, Values } from "./types";
import { VocabularyFields } from "./vocabulary-fields";

/**
 * The type picker + per-type fields + common fields + submit. Shared by the
 * manual path and the AI review step (which passes a different submit label
 * and a "start over" secondary action).
 */
export function KnowledgeForm({
  type,
  onTypeChange,
  values,
  errors,
  set,
  examples,
  setExamples,
  formRef,
  onSubmit,
  submitLabel,
  secondaryAction,
  disabled,
  error,
  notice,
  typeLocked,
}: {
  type: PickerType;
  onTypeChange: (type: PickerType) => void;
  values: Values;
  errors: Errors;
  set: (name: string, value: string) => void;
  examples: Example[];
  setExamples: Dispatch<SetStateAction<Example[]>>;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  secondaryAction?: ReactNode;
  disabled?: boolean;
  error?: string | null;
  /** Rendered just above the submit row — e.g. the "already in your library" warning. */
  notice?: ReactNode;
  typeLocked?: boolean;
}) {
  const t = useTranslations("add");

  return (
    <div className="flex flex-col gap-6">
      {typeLocked ? null : <TypePicker value={type} onChange={onTypeChange} />}

      {type === "file" ? (
        <FilePlaceholder />
      ) : (
        <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {type === "vocabulary" && <VocabularyFields values={values} errors={errors} set={set} />}
          {type === "grammar" && (
            <GrammarFields
              values={values}
              errors={errors}
              set={set}
              examples={examples}
              setExamples={setExamples}
            />
          )}
          {type === "reading" && <ReadingFields values={values} errors={errors} set={set} />}
          {type === "note" && <NoteFields values={values} errors={errors} set={set} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("levelLabel")} htmlFor="add-level">
              <Select
                id="add-level"
                name="level"
                value={values.level ?? ""}
                onChange={(e) => set("level", e.target.value)}
              >
                <option value="">{t("levelNone")}</option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("tagsLabel")} htmlFor="add-tags" hint={t("tagsHint")}>
              <Input
                id="add-tags"
                name="tags"
                value={values.tags ?? ""}
                onChange={(e) => set("tags", e.target.value)}
                aria-describedby="add-tags-hint"
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}

          {notice}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" size="md" disabled={disabled}>
              {submitLabel}
            </Button>
            {secondaryAction}
          </div>
        </form>
      )}
    </div>
  );
}

function FilePlaceholder() {
  const t = useTranslations("add.file");
  return (
    <div className="rounded-card border border-dashed border-border-default bg-surface p-8 text-center">
      <p className="font-display text-title text-fg">{t("title")}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-fg-muted">{t("body")}</p>
    </div>
  );
}
