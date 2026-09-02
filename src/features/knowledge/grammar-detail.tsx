import { getTranslations } from "next-intl/server";

import type { GrammarItem } from "@/types";
import { Section } from "@/components/layout";

/** Full detail for a grammar item: summary, explanation prose, worked examples. */
export async function GrammarDetail({ item }: { item: GrammarItem }) {
  const t = await getTranslations("knowledge.detail");

  return (
    <div className="flex flex-col gap-8">
      <p className="text-body-lg text-fg-secondary">{item.summary}</p>

      <Section title={t("explanation")}>
        <p className="text-body whitespace-pre-line text-fg-secondary">{item.explanation}</p>
      </Section>

      {item.examples.length > 0 ? (
        <Section title={t("examples")}>
          <ul className="flex flex-col gap-3">
            {item.examples.map((ex) => (
              <li
                key={ex.nl}
                className="flex flex-col gap-0.5 border-l-2 border-knowledge-grammar pl-4"
              >
                <span className="font-reading text-reading text-fg">{ex.nl}</span>
                {ex.en ? <span className="text-body-sm text-fg-muted">{ex.en}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
