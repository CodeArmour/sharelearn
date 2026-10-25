"use client";

import { type FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  discardSpreadsheetImportAction,
  extractFromFilesAction,
  extractSpreadsheetBatchAction,
  structureKnowledgeAction,
} from "@/server/actions/ai";
import {
  createKnowledgeItemAction,
  createKnowledgeItemsAction,
  updateKnowledgeItemAction,
} from "@/server/actions/knowledge";
import { generateGrammarQuizAction, generateReadingQuizAction } from "@/server/actions/practice";
import type { AiSuggestion, KnowledgeItem, KnowledgeSource } from "@/types";
import { knowledgeTitle } from "@/types";

import { AiCaptureBox } from "./ai-capture-box";
import { AiFailedPanel } from "./ai-failed-panel";
import { AiReviewBanner } from "./ai-review-banner";
import { prepareCaptureFile } from "./capture-files";
import { KnowledgeForm } from "./knowledge-form";
import { ReviewChecklist, type ReviewRow } from "./review-checklist";
import { SuccessPanel } from "./success-panel";
import { buildCreateInput, missingRequired, suggestionToDraft } from "./suggestion-to-input";
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

type Mode = "manual" | "processing" | "review" | "failed" | "review-list" | "review-edit";

type SpreadsheetImport = {
  path: string;
  totalRows: number;
  processedRows: number;
  nextCursor: number | null;
};

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
  userId,
}: { existingItem?: KnowledgeItem; aiEnabled?: boolean; userId?: string } = {}) {
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

  // File capture: a batch of drafts the reviewer checks off before saving.
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [spreadsheetImport, setSpreadsheetImport] = useState<SpreadsheetImport | null>(null);

  // Set when a submit hit an existing item; the next submit passes
  // `allowDuplicate` so the reviewer can add it anyway. Cleared on any edit.
  const [dupPrompt, setDupPrompt] = useState<{ label: string; existingId: string } | null>(null);

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
    setDupPrompt(null);
  };

  const resetFields = () => {
    setValues({});
    setExamples([]);
    setErrors({});
    setDupPrompt(null);
  };

  const changeType = (next: PickerType) => {
    setType(next);
    resetFields();
  };

  const runAi = async () => {
    setMode("processing");
    setDupPrompt(null);
    try {
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
    } catch {
      setMode("failed");
    }
  };

  const rowsFromSuggestions = (items: AiSuggestion[], duplicates: number[]): ReviewRow[] => {
    const rows: ReviewRow[] = items.map((suggestion) => {
      const draft = suggestionToDraft(suggestion);
      return { id: crypto.randomUUID(), checked: true, ...draft };
    });
    for (const index of duplicates) {
      if (rows[index]) {
        rows[index].duplicate = true;
        rows[index].checked = false;
      }
    }
    for (const row of rows) {
      if (missingRequired(row.type, row.values).length > 0) row.checked = false;
    }
    return rows;
  };

  const loadSpreadsheetBatch = async (path: string, cursor: number) => {
    setMode("processing");
    setDupPrompt(null);
    setBatchError(null);
    try {
      let nextCursor = cursor;
      while (true) {
        const result = await extractSpreadsheetBatchAction({ path, cursor: nextCursor });
        if (!result.ok) {
          void discardSpreadsheetImportAction(path);
          setSpreadsheetImport(null);
          setMode("failed");
          return;
        }
        if (result.data.items.length > 0) {
          setReviewRows(rowsFromSuggestions(result.data.items, result.data.duplicates));
          setTruncated(false);
          setSpreadsheetImport({
            path,
            totalRows: result.data.totalRows,
            processedRows: result.data.processedRows,
            nextCursor: result.data.nextCursor,
          });
          setMode("review-list");
          return;
        }
        if (result.data.nextCursor === null) {
          void discardSpreadsheetImportAction(path);
          setSpreadsheetImport(null);
          setMode("failed");
          return;
        }
        nextCursor = result.data.nextCursor;
      }
    } catch {
      void discardSpreadsheetImportAction(path);
      setSpreadsheetImport(null);
      setMode("failed");
    }
  };

  const runFileAi = async (files: File[]) => {
    if (!userId || files.length === 0) return;
    setMode("processing");
    setDupPrompt(null);
    setSpreadsheetImport(null);
    const supabase = createBrowserSupabaseClient();
    const bucket = supabase.storage.from(CAPTURE_BUCKET);
    const paths: string[] = [];
    const extensions: string[] = [];
    try {
      for (const file of files) {
        const prepared = await prepareCaptureFile(file);
        const path = `${userId}/${crypto.randomUUID()}.${prepared.extension}`;
        const { error } = await bucket.upload(path, prepared.content, {
          contentType: prepared.contentType,
        });
        if (error) throw error;
        paths.push(path);
        extensions.push(prepared.extension);
      }

      if (paths.length === 1 && ["xls", "xlsx"].includes(extensions[0])) {
        setSpreadsheetImport({ path: paths[0], totalRows: 0, processedRows: 0, nextCursor: 0 });
        await loadSpreadsheetBatch(paths[0], 0);
        return;
      }

      const result = await extractFromFilesAction(paths);
      if (!result.ok || result.data.items.length === 0) {
        setMode("failed");
        return;
      }

      const rows: ReviewRow[] = result.data.items.map((s) => {
        const draft = suggestionToDraft(s);
        return { id: crypto.randomUUID(), checked: true, ...draft };
      });
      // Items already in the library: flagged and unchecked, but still editable
      // and re-checkable — re-checking one is the per-row "add anyway".
      for (const i of result.data.duplicates) {
        if (rows[i]) {
          rows[i].duplicate = true;
          rows[i].checked = false;
        }
      }
      // rows missing a required field can't be checked until edited
      for (const row of rows) {
        if (missingRequired(row.type, row.values).length > 0) row.checked = false;
      }
      setReviewRows(rows);
      setTruncated(result.data.truncated);
      setBatchError(null);
      setMode("review-list");
    } catch {
      if (paths.length > 0) await bucket.remove(paths).catch(() => {});
      setMode("failed");
    }
  };

  const toggleRow = (id: string) =>
    setReviewRows((rs) => rs.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  const toggleAllRows = (checked: boolean) =>
    setReviewRows((rs) =>
      rs.map((r) => (missingRequired(r.type, r.values).length > 0 ? r : { ...r, checked })),
    );
  const removeRow = (id: string) => setReviewRows((rs) => rs.filter((r) => r.id !== id));

  const editRow = (id: string) => {
    const row = reviewRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setType(row.type);
    setValues(row.values);
    setExamples(row.examples);
    setErrors({});
    setDupPrompt(null);
    setMode("review-edit");
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    resetFields();
    setMode("review-list");
  };

  const nextSpreadsheetBatch = () => {
    if (!spreadsheetImport || spreadsheetImport.nextCursor === null) return;
    void loadSpreadsheetBatch(spreadsheetImport.path, spreadsheetImport.nextCursor);
  };

  const saveBatch = async () => {
    const selected = reviewRows.filter((r) => r.checked);
    if (selected.length === 0) return;
    const currentSpreadsheetImport = spreadsheetImport;
    setSaving(true);
    setBatchError(null);
    try {
      const inputs = selected.map((r) =>
        buildCreateInput(r.type, r.values, r.examples, "ai-assisted"),
      );
      const result = await createKnowledgeItemsAction(inputs);
      if (!result.ok) {
        setBatchError(t("ai.review.failed"));
        return;
      }
      for (const id of result.data.ids) {
        // fire-and-forget: the quiz backfills on its own if this never lands
        void generateReadingQuizAction(id).catch((e) =>
          console.error("generateReadingQuizAction rejected", e),
        );
        void generateGrammarQuizAction(id).catch((e) =>
          console.error("generateGrammarQuizAction rejected", e),
        );
      }
      if (currentSpreadsheetImport && currentSpreadsheetImport.nextCursor !== null) {
        await loadSpreadsheetBatch(currentSpreadsheetImport.path, currentSpreadsheetImport.nextCursor);
        return;
      }
      if (currentSpreadsheetImport) {
        void discardSpreadsheetImportAction(currentSpreadsheetImport.path);
        setSpreadsheetImport(null);
      }
      setSavedTitle(t("ai.review.successCount", { count: result.data.ids.length }));
    } catch {
      setBatchError(t("ai.review.failed"));
    } finally {
      setSaving(false);
    }
  };

  const fillManuallyFromFailure = () => {
    setType("note");
    setValues({ noteBody: rawText, title: "" });
    setExamples([]);
    setErrors({});
    setDupPrompt(null);
    setMode("manual");
  };

  const backToManual = () => {
    if (spreadsheetImport) void discardSpreadsheetImportAction(spreadsheetImport.path);
    resetFields();
    setNoticeKey(undefined);
    setReviewRows([]);
    setSpreadsheetImport(null);
    setMode("manual");
  };

  const handleSubmit = async (e: FormEvent) => {
    // Editing one checklist row: same required-field validation, but the save
    // writes back into the row instead of hitting a Server Action.
    if (mode === "review-edit" && editingRowId) {
      e.preventDefault();
      const required = REQUIRED[type as AuthableType];
      const nextErrors: Errors = {};
      for (const name of required) {
        if (!(values[name] ?? "").trim()) {
          const labelKey = LABEL_KEY[name] as Parameters<typeof t>[0];
          nextErrors[name] = t("required", { field: t(labelKey) });
        }
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      setReviewRows((rs) =>
        rs.map((r) =>
          r.id === editingRowId
            ? { ...r, type: type as AuthableType, values, examples, checked: true }
            : r,
        ),
      );
      setEditingRowId(null);
      resetFields();
      setMode("review-list");
      return;
    }

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
        : await createKnowledgeItemAction(input, { allowDuplicate: dupPrompt != null });
      if (!result.ok) {
        if (result.code === "duplicate" && result.existingId) {
          setDupPrompt({ label: result.label ?? "", existingId: result.existingId });
          return;
        }
        setSaveError(t("errors.generic"));
        return;
      }
      setDupPrompt(null);
      if (isEditing) {
        if (input.type === "reading")
          // fire-and-forget: the quiz backfills on its own if this never lands
          void generateReadingQuizAction(existingItem.id).catch((e) =>
            console.error("generateReadingQuizAction rejected", e),
          );
        if (input.type === "grammar")
          // fire-and-forget: the quiz backfills on its own if this never lands
          void generateGrammarQuizAction(existingItem.id).catch((e) =>
            console.error("generateGrammarQuizAction rejected", e),
          );
        router.push(`/knowledge/${existingItem.id}`);
        return;
      }
      // knowledgeTitle() returns "" for a titleless note — fall back to a
      // snippet of the body so the success panel still shows something.
      const title = knowledgeTitle(result.data);
      setSavedTitle(
        title || (result.data.type === "note" ? result.data.body.trim().slice(0, 50) : title),
      );
      if (result.data.type === "reading")
        // fire-and-forget: the quiz backfills on its own if this never lands
        void generateReadingQuizAction(result.data.id).catch((e) =>
          console.error("generateReadingQuizAction rejected", e),
        );
      if (result.data.type === "grammar")
        // fire-and-forget: the quiz backfills on its own if this never lands
        void generateGrammarQuizAction(result.data.id).catch((e) =>
          console.error("generateGrammarQuizAction rejected", e),
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
    setReviewRows([]);
    setTruncated(false);
    setEditingRowId(null);
    setBatchError(null);
    setSpreadsheetImport(null);
    setDupPrompt(null);
    setMode("manual");
  };

  // Hoisted out of the render ladder below: inside the final branch TypeScript
  // has already narrowed `mode` to "manual", so the comparison can't live there.
  const filesBusy = mode === "processing";

  const duplicateNotice = dupPrompt ? (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-3">
      <p className="text-body-sm text-fg-secondary">
        {t("duplicate.prompt", { label: dupPrompt.label })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => formRef.current?.requestSubmit()}
        >
          {t("duplicate.addAnyway")}
        </Button>
        <Link
          href={`/knowledge/${dupPrompt.existingId}`}
          className="text-body-sm font-medium text-link hover:underline"
        >
          {t("duplicate.viewExisting")}
        </Link>
      </div>
    </div>
  ) : undefined;

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
      notice={duplicateNotice}
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
        ) : mode === "review-list" ? (
          <div className="flex flex-col gap-6">
            <AiReviewBanner truncated={truncated} />
            {spreadsheetImport ? (
              <p className="rounded-lg bg-ai-subtle p-3 text-body-sm text-fg-secondary">
                {t("ai.spreadsheet.progress", {
                  processed: spreadsheetImport.processedRows,
                  total: spreadsheetImport.totalRows,
                })}
              </p>
            ) : null}
            {batchError ? <p className="text-body-sm text-error-strong">{batchError}</p> : null}
            <ReviewChecklist
              truncated={truncated}
              rows={reviewRows}
              onToggle={toggleRow}
              onToggleAll={toggleAllRows}
              onEdit={editRow}
              onRemove={removeRow}
              onSubmit={saveBatch}
              submitting={saving}
              nextBatch={
                spreadsheetImport && spreadsheetImport.nextCursor !== null
                  ? { label: t("ai.spreadsheet.next"), onNext: nextSpreadsheetBatch }
                  : undefined
              }
            />
            {spreadsheetImport ? (
              <Button type="button" variant="ghost" size="md" onClick={backToManual}>
                {t("ai.spreadsheet.cancel")}
              </Button>
            ) : null}
          </div>
        ) : mode === "review-edit" ? (
          <div className="flex flex-col gap-6">
            <AiReviewBanner />
            {form(
              t("ai.confirm"),
              <Button type="button" variant="ghost" size="md" onClick={cancelEditRow}>
                {t("ai.startOver")}
              </Button>,
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {!isEditing && aiEnabled ? (
              <>
                <AiCaptureBox
                  value={rawText}
                  onChange={setRawText}
                  onSubmit={runAi}
                  filesEnabled={Boolean(userId)}
                  onStructureFiles={runFileAi}
                  filesBusy={filesBusy}
                />
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
