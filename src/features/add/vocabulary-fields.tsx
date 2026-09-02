import { useTranslations } from "next-intl";

import { AreaField, SelectField, TextField } from "./field-controls";
import type { FieldsProps } from "./types";

export function VocabularyFields({ values, errors, set }: FieldsProps) {
  const t = useTranslations("add");
  const fp = { values, errors, set };

  return (
    <>
      <TextField {...fp} name="term" label={t("field.term")} required />
      <TextField {...fp} name="meaning" label={t("field.meaning")} required />
      <TextField
        {...fp}
        name="partOfSpeech"
        label={t("field.partOfSpeech")}
        hint={t("field.partOfSpeechHint")}
        required
      />
      <TextField {...fp} name="example" label={t("field.example")} />
      <TextField {...fp} name="exampleTranslation" label={t("field.exampleTranslation")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField {...fp} name="article" label={t("field.article")}>
          <option value="">{t("field.articleNone")}</option>
          <option value="de">de</option>
          <option value="het">het</option>
        </SelectField>
        <TextField {...fp} name="plural" label={t("field.plural")} />
        <TextField {...fp} name="pastTense" label={t("field.pastTense")} />
        <TextField {...fp} name="perfect" label={t("field.perfect")} />
      </div>

      <AreaField {...fp} name="usageNote" label={t("field.usageNote")} rows={3} />
    </>
  );
}
