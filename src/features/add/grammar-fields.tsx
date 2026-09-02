import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { ExampleList } from "./example-list";
import { AreaField, TextField } from "./field-controls";
import type { Example, FieldsProps } from "./types";

export function GrammarFields({
  values,
  errors,
  set,
  examples,
  setExamples,
}: FieldsProps & { examples: Example[]; setExamples: Dispatch<SetStateAction<Example[]>> }) {
  const t = useTranslations("add");
  const fp = { values, errors, set };

  return (
    <>
      <TextField {...fp} name="title" label={t("field.title")} required />
      <TextField
        {...fp}
        name="summary"
        label={t("field.summary")}
        hint={t("field.summaryHint")}
        required
      />
      <AreaField {...fp} name="explanation" label={t("field.explanation")} rows={5} required />
      <ExampleList examples={examples} setExamples={setExamples} />
    </>
  );
}
