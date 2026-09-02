import type { Dispatch, SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, IconButton, Input } from "@/components/ui";

import type { Example } from "./types";

/** Repeatable NL / translation example pairs for a grammar item. Optional. */
export function ExampleList({
  examples,
  setExamples,
}: {
  examples: Example[];
  setExamples: Dispatch<SetStateAction<Example[]>>;
}) {
  const t = useTranslations("add.grammar");

  const update = (id: string, key: "nl" | "en", value: string) =>
    setExamples((xs) => xs.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  const remove = (id: string) => setExamples((xs) => xs.filter((x) => x.id !== id));
  const add = () =>
    setExamples((xs) => [...xs, { id: crypto.randomUUID(), nl: "", en: "" }]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-label font-medium text-fg-secondary">{t("examples")}</span>

      {examples.map((ex, i) => (
        <div key={ex.id} className="flex items-start gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <Input
              aria-label={`${t("exampleNl")} ${i + 1}`}
              placeholder={t("exampleNl")}
              value={ex.nl}
              onChange={(e) => update(ex.id, "nl", e.target.value)}
            />
            <Input
              aria-label={`${t("exampleEn")} ${i + 1}`}
              placeholder={t("exampleEn")}
              value={ex.en}
              onChange={(e) => update(ex.id, "en", e.target.value)}
            />
          </div>
          <IconButton
            size="md"
            variant="ghost"
            aria-label={t("removeExample")}
            onClick={() => remove(ex.id)}
            icon={<X strokeWidth={1.75} />}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-fit">
        <Plus className="-ml-0.5 size-4" strokeWidth={2} aria-hidden />
        {t("addExample")}
      </Button>
    </div>
  );
}
