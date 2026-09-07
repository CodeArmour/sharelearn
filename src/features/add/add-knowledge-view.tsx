"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { structureKnowledgeAction } from "@/server/actions/ai";
import { createKnowledgeItemAction, updateKnowledgeItemAction } from "@/server/actions/knowledge";
import type { CreateKnowledgeItemInput } from "@/server/actions/schemas";
import type { KnowledgeItem, KnowledgeSource } from "@/types";
import { knowledgeTitle } from "@/types";

import { AiCaptureBox } from "./ai-capture-box";
import { AiFailedPanel } from "./ai-failed-panel";
import { AiReviewBanner } from "./ai-review-banner";
import { KnowledgeForm } from "./knowledge-form";
import { SuccessPanel } from "./success-panel";
import {
  type AuthableType,
  type Errors,
  type Example,
  itemToValues,
  LABEL_KEY,
  type PickerType,
  REQUIRED,
  type Values,
} from "./types";

type Mode = "manual" | "processing" | "review" | "failed";

function parseTags(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toNullable(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function buildCreateInput(
  type: AuthableType,
  values: Values,
  examples: Example[],
  source: KnowledgeSource,
): CreateKnowledgeItemInput {
  const shared = {
    level: (values.level || null) as CreateKnowledgeItemInput["level"],
    tags: parseTags(values.tags),
    source,
  };

  switch (type) {
    case "vocabulary":
      return {
        ...shared,
        type: "vocabulary",
        term: values.term!.trim(),
        meaning: values.meaning!.trim(),
        partOfSpeech: values.partOfSpeech!.trim(),
        example: toNullable(values.example),
        exampleTranslation: toNullable(values.exampleTranslation),
        article: values.article === "de" || values.article === "het" ? values.article : null,
        plural: toNullable(values.plural),
        pastTense: toNullable(values.pastTense),
        perfect: toNullable(values.perfect),
        usageNote: toNullable(values.usageNote),
      };
    case "grammar":
      return {
        ...shared,
        type: "grammar",
        title: values.title!.trim(),
        summary: values.summary!.trim(),
        explanation: values.explanation!.trim(),
        examples: examples
          .filter((e) => e.nl.trim().length > 0)
          .map((e) => ({ nl: e.nl.trim(), en: toNullable(e.en) })),
      };
    case "reading":
      return {
        ...shared,
        type: "reading",
        title: values.title!.trim(),
        body: values.readingBody!.trim(),
        summary: toNullable(values.summary),
      };
    case "note":
      return {
        ...shared,
        type: "note",
        title: toNullable(values.title),
        body: values.noteBody!.trim(),
      };
  }
}

/**
 * Capture knowledge, two ways. The manual path is a plain form. The AI path
 * hands pasted text to `structureKnowledgeAction`, then drops the reviewer
 * into the same form pre-filled — they always confirm before it saves. A
 * valid submit persists the item via `createKnowledgeItemAction` and shows a
 * confirmation on success, or an inline error near the submit button on failure.
 */
export function AddKnowledgeView({
  existingItem,
  aiEnabled = false,
}: { existingItem?: KnowledgeItem; aiEnabled?: boolean } = {}) {
  const t = useTranslations("add");
  const tPage = useTranslations("pages.add");
  const router = useRouter();
  const isEditing = existingItem != null;
  const initial = existingItem ? itemToValues(existingItem) : undefined;

  const [mode, setMode] = useState<Mode>("manual");
  const [rawText, setRawText] = useState("");
  const [noticeKey, setNoticeKey] = useState<string | undefined>();

  const [type, setType] = useState<PickerType>(initial?.type ?? "vocabulary");
  const [values, setValues] = useState<Values>(initial?.values ?? {});
  const [examples, setExamples] = useState<Example[]>(initial?.examples ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const runAi = async () => {
    setMode("processing");
    const result = await structureKnowledgeAction(rawText);
    if (!result.ok) {
      setMode("failed");
      return;
    }
    const suggestion = result.data;
    setType(suggestion.type as PickerType);
    setValues(suggestion.fields);
    setExamples((suggestion.examples ?? []).map((ex) => ({ id: crypto.randomUUID(), ...ex })));
    setErrors({});
    setNoticeKey(suggestion.noticeKey);
    setMode("review");
  };

  const fillManuallyFromFailure = () => {
    setType("note");
    setValues({ noteBody: rawText, title: "" });
    setExamples([]);
    setErrors({});
    setMode("manual");
  };

  const backToManual = () => {
    resetFields();
    setNoticeKey(undefined);
    setMode("manual");
  };

  const handleSubmit = async (e: FormEvent) => {
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

    const source: KnowledgeSource = mode !== "review" ? "manual" : "ai-assisted";
    const input = buildCreateInput(type, values, examples, source);

    setSaving(true);
    setSaveError(null);
    try {
      const result = isEditing
        ? await updateKnowledgeItemAction(existingItem.id, input)
        : await createKnowledgeItemAction(input);
      if (!result.ok) {
        setSaveError(t("errors.generic"));
        return;
      }
      if (isEditing) {
        router.push(`/knowledge/${existingItem.id}`);
        return;
      }
      // knowledgeTitle() returns "" for a titleless note — fall back to a
      // snippet of the body so the success panel still shows something.
      const title = knowledgeTitle(result.data);
      setSavedTitle(
        title || (result.data.type === "note" ? result.data.body.trim().slice(0, 50) : title),
      );
    } catch {
      setSaveError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const afterSuccess = () => {
    resetFields();
    setRawText("");
    setNoticeKey(undefined);
    setSavedTitle(null);
    setMode("manual");
  };

  const form = (submitLabel: string, secondaryAction?: React.ReactNode) => (
    <KnowledgeForm
      type={type}
      onTypeChange={changeType}
      values={values}
      errors={errors}
      set={set}
      examples={examples}
      setExamples={setExamples}
      formRef={formRef}
      onSubmit={handleSubmit}
      submitLabel={submitLabel}
      secondaryAction={secondaryAction}
      disabled={saving}
      error={saveError}
      typeLocked={isEditing}
    />
  );

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[42rem]">
        <PageHeader
          title={isEditing ? t("saveChanges") : tPage("title")}
          description={isEditing ? undefined : tPage("subtitle")}
        />

        {savedTitle !== null ? (
          <SuccessPanel title={savedTitle} onAddAnother={afterSuccess} />
        ) : mode === "processing" ? (
          <div className="flex items-center gap-3 rounded-card border border-ai-border bg-ai-subtle p-6">
            <Loader2 className="size-5 shrink-0 animate-spin text-ai" strokeWidth={2} aria-hidden />
            <span className="text-body text-fg-secondary">{t("ai.processing")}</span>
          </div>
        ) : mode === "failed" ? (
          <AiFailedPanel
            onFillManually={fillManuallyFromFailure}
            onCancel={() => {
              setRawText("");
              backToManual();
            }}
          />
        ) : mode === "review" ? (
          <div className="flex flex-col gap-6">
            <AiReviewBanner noticeKey={noticeKey} />
            {form(
              saving ? t("ai.processing") : t("ai.confirm"),
              <Button type="button" variant="ghost" size="md" onClick={backToManual}>
                {t("ai.startOver")}
              </Button>,
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {!isEditing && aiEnabled ? (
              <>
                <AiCaptureBox value={rawText} onChange={setRawText} onSubmit={runAi} />
                <div className="flex items-center gap-3 text-caption text-fg-muted">
                  <span className="h-px flex-1 bg-border" />
                  {t("ai.divider")}
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : null}
            {form(saving ? t("ai.processing") : isEditing ? t("saveChanges") : t("submit"))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
