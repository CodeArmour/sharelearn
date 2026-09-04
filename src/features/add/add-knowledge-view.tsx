"use client";

import { type FormEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { getAiSuggestion, getAiSuggestionFromAttachment } from "@/data/mock";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { createKnowledgeItemAction } from "@/server/actions/knowledge";
import type { CreateKnowledgeItemInput } from "@/server/actions/schemas";
import type { KnowledgeSource } from "@/types";
import { knowledgeTitle } from "@/types";

import { AiCaptureBox } from "./ai-capture-box";
import { AiFailedPanel } from "./ai-failed-panel";
import { AiReviewBanner } from "./ai-review-banner";
import { KnowledgeForm } from "./knowledge-form";
import { SuccessPanel } from "./success-panel";
import {
  type AiAttachment,
  type AuthableType,
  type Errors,
  type Example,
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
 * hands pasted text to a (simulated) structuring step, then drops the reviewer
 * into the same form pre-filled — they always confirm before it "saves".
 * Nothing persists yet; a valid submit shows a confirmation that says so.
 */
export function AddKnowledgeView() {
  const t = useTranslations("add");
  const tPage = useTranslations("pages.add");

  const attachParam = useSearchParams().get("attach");
  const autoOpen = attachParam === "photo" || attachParam === "file" ? attachParam : undefined;

  const [mode, setMode] = useState<Mode>("manual");
  const [rawText, setRawText] = useState("");
  const [attachment, setAttachment] = useState<AiAttachment | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | undefined>();

  const [type, setType] = useState<PickerType>("vocabulary");
  const [values, setValues] = useState<Values>({});
  const [examples, setExamples] = useState<Example[]>([]);
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

  const runAi = () => {
    setMode("processing");
    window.setTimeout(async () => {
      const suggestion = attachment
        ? await getAiSuggestionFromAttachment(attachment)
        : await getAiSuggestion(rawText);
      if (!suggestion) {
        setMode("failed");
        return;
      }
      setType(suggestion.type as PickerType);
      setValues(suggestion.fields);
      setExamples((suggestion.examples ?? []).map((ex) => ({ id: crypto.randomUUID(), ...ex })));
      setErrors({});
      setNoticeKey(suggestion.noticeKey);
      setMode("review");
    }, 900);
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

    const source: KnowledgeSource =
      mode !== "review" ? "manual" : attachment ? (attachment.kind === "image" ? "photo" : "file-upload") : "ai-assisted";
    const input = buildCreateInput(type, values, examples, source);

    setSaving(true);
    setSaveError(null);
    const result = await createKnowledgeItemAction(input);
    setSaving(false);
    if (!result.ok) {
      setSaveError(t("errors.generic"));
      return;
    }
    setSavedTitle(knowledgeTitle(result.data));
  };

  const afterSuccess = () => {
    resetFields();
    setRawText("");
    setAttachment(null);
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
    />
  );

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[42rem]">
        <PageHeader title={tPage("title")} description={tPage("subtitle")} />

        {saveError ? (
          <p role="alert" className="mb-4 text-body-sm text-danger">
            {saveError}
          </p>
        ) : null}

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
              setAttachment(null);
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
            <AiCaptureBox
              value={rawText}
              onChange={setRawText}
              attachment={attachment}
              onAttachmentChange={setAttachment}
              autoOpen={autoOpen}
              onSubmit={runAi}
            />
            <div className="flex items-center gap-3 text-caption text-fg-muted">
              <span className="h-px flex-1 bg-border" />
              {t("ai.divider")}
              <span className="h-px flex-1 bg-border" />
            </div>
            {form(saving ? t("ai.processing") : t("submit"))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
