import { getTranslations } from "next-intl/server";

import type { VocabularyItem } from "@/types";
import { Section } from "@/components/layout";

import { Field, FieldList } from "./fields";

/**
 * Full detail for a vocabulary item — the same linguistic fields the deferred
 * expandable Library table row will show: gloss, word type, an example with its
 * translation, the grammatical forms that apply, and a usage note.
 */
export async function VocabularyDetail({ item }: { item: VocabularyItem }) {
  const t = await getTranslations("knowledge.detail");

  const forms = [
    item.article && { label: t("article"), value: item.article },
    item.plural && { label: t("plural"), value: item.plural },
    item.pastTense && { label: t("pastTense"), value: item.pastTense },
    item.perfect && { label: t("perfect"), value: item.perfect },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <p className="text-body-lg text-fg-secondary">{item.meaning}</p>
        <FieldList>
          <Field label={t("partOfSpeech")}>{item.partOfSpeech}</Field>
          {item.level ? <Field label={t("level")}>{item.level}</Field> : null}
        </FieldList>
      </div>

      {item.example ? (
        <Section title={t("example")}>
          <figure className="flex flex-col gap-1 border-l-2 border-knowledge-vocabulary pl-4">
            <p className="font-reading text-reading text-fg italic">{item.example}</p>
            {item.exampleTranslation ? (
              <figcaption className="text-body-sm text-fg-muted">
                {item.exampleTranslation}
              </figcaption>
            ) : null}
          </figure>
        </Section>
      ) : null}

      {forms.length > 0 ? (
        <Section title={t("forms")}>
          <FieldList>
            {forms.map((f) => (
              <Field key={f.label} label={f.label}>
                {f.value}
              </Field>
            ))}
          </FieldList>
        </Section>
      ) : null}

      {item.usageNote ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-subtle p-4">
          <span className="text-label text-fg-muted">{t("usageNote")}</span>
          <p className="text-body-sm text-fg-secondary">{item.usageNote}</p>
        </div>
      ) : null}
    </div>
  );
}
