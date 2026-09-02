import { useTranslations } from "next-intl";

import { AreaField, TextField } from "./field-controls";
import type { FieldsProps } from "./types";

export function NoteFields({ values, errors, set }: FieldsProps) {
  const t = useTranslations("add");
  const fp = { values, errors, set };

  return (
    <>
      <TextField {...fp} name="title" label={t("field.title")} />
      <AreaField {...fp} name="noteBody" label={t("field.noteBody")} rows={6} required />
    </>
  );
}
