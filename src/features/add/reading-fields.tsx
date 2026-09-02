import { useTranslations } from "next-intl";

import { AreaField, TextField } from "./field-controls";
import type { FieldsProps } from "./types";

export function ReadingFields({ values, errors, set }: FieldsProps) {
  const t = useTranslations("add");
  const fp = { values, errors, set };
  const words = (values.readingBody ?? "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <TextField {...fp} name="title" label={t("field.title")} required />
      <AreaField
        {...fp}
        name="readingBody"
        label={t("field.readingBody")}
        hint={t("reading.wordCount", { count: words })}
        rows={8}
        required
      />
      <TextField {...fp} name="summary" label={t("field.summary")} hint={t("field.summaryHint")} />
    </>
  );
}
