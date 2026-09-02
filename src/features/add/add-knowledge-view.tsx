"use client";

import { type FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { CEFR_LEVELS } from "@/types";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button, Field, Input, Select } from "@/components/ui";

import { GrammarFields } from "./grammar-fields";
import { NoteFields } from "./note-fields";
import { ReadingFields } from "./reading-fields";
import { SuccessPanel } from "./success-panel";
import { TypePicker } from "./type-picker";
import {
  type AuthableType,
  type Errors,
  type Example,
  LABEL_KEY,
  type PickerType,
  REQUIRED,
  type Values,
} from "./types";
import { VocabularyFields } from "./vocabulary-fields";

function deriveTitle(type: AuthableType, values: Values): string {
  if (type === "vocabulary") return values.term?.trim() ?? "";
  if (type === "note") return (values.title?.trim() || values.noteBody?.trim().slice(0, 50)) ?? "";
  return values.title?.trim() ?? "";
}

/**
 * Manual capture form. A person picks a knowledge type and fills the fields;
 * the AI suggestion / confirm flow (the Figma "AI voorstel" panel) is the
 * separate "AI Review" roadmap item. No persistence yet — a valid submit shows
 * a confirmation that says so.
 */
export function AddKnowledgeView() {
  const t = useTranslations("add");
  const tPage = useTranslations("pages.add");

  const [type, setType] = useState<PickerType>("vocabulary");
  const [values, setValues] = useState<Values>({});
  const [examples, setExamples] = useState<Example[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
  };

  const resetFields = () => {
    setValues({});
    setExamples([]);
    setErrors({});
  };

  const changeType = (next: PickerType) => {
    setType(next);
    resetFields();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (type === "file") return;

    const required = REQUIRED[type];
    const nextErrors: Errors = {};
    for (const name of required) {
      if (!(values[name] ?? "").trim()) {
        // LABEL_KEY holds valid `add.*` keys; cast past next-intl's literal-key type.
        const labelKey = LABEL_KEY[name] as Parameters<typeof t>[0];
        nextErrors[name] = t("required", { field: t(labelKey) });
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const first = required.find((name) => nextErrors[name]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setSavedTitle(deriveTitle(type, values));
  };

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[42rem]">
        <PageHeader title={tPage("title")} description={tPage("subtitle")} />

        {savedTitle !== null ? (
          <SuccessPanel
            title={savedTitle}
            onAddAnother={() => {
              resetFields();
              setSavedTitle(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <TypePicker value={type} onChange={changeType} />

            {type === "file" ? (
              <FilePlaceholder />
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                {type === "vocabulary" && (
                  <VocabularyFields values={values} errors={errors} set={set} />
                )}
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

                <div className="pt-1">
                  <Button type="submit" size="md">
                    {t("submit")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </PageContainer>
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
