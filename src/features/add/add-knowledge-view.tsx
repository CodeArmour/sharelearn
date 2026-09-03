"use client";

import { type FormEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { getAiSuggestion, getAiSuggestionFromAttachment } from "@/data/mock";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";

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

function deriveTitle(type: AuthableType, values: Values): string {
  if (type === "vocabulary") return values.term?.trim() ?? "";
  if (type === "note") return (values.title?.trim() || values.noteBody?.trim().slice(0, 50)) ?? "";
  return values.title?.trim() ?? "";
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
              t("ai.confirm"),
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
            {form(t("submit"))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
