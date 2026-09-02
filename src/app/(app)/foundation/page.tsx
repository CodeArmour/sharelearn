import { ArrowRight, BookOpen, Check, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageContainer, PageHeader, Section } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { titleMetadata } from "@/lib/page-metadata";

export const generateMetadata = titleMetadata((t) => t("foundation.title"));

/**
 * Development-only reference page. Verifies that Figma tokens, the type scale and
 * the foundational components render correctly inside the app shell, at every
 * breakpoint. Not linked from navigation; safe to delete once screens exist.
 */

const SURFACES = [
  ["bg-background", "background"],
  ["bg-background-subtle", "background-subtle"],
  ["bg-surface border border-border", "surface"],
  ["bg-surface-sunken", "surface-sunken"],
  ["bg-surface-selected", "surface-selected"],
] as const;

const ACCENTS = [
  ["bg-primary", "primary"],
  ["bg-primary-hover", "primary-hover"],
  ["bg-success", "success"],
  ["bg-warning", "warning"],
  ["bg-error", "error"],
  ["bg-info", "info"],
] as const;

const KNOWLEDGE = [
  ["bg-knowledge-vocabulary", "knowledge-vocabulary"],
  ["bg-knowledge-grammar", "knowledge-grammar"],
  ["bg-knowledge-reading", "knowledge-reading"],
  ["bg-knowledge-file", "knowledge-file"],
  ["bg-ai-accent", "ai-accent"],
] as const;

const TYPE_SCALE = [
  ["text-display font-display", "Display", "Een dagje Antwerpen"],
  ["text-h1 font-display", "Heading 1", "Een dagje Antwerpen"],
  ["text-h2 font-display", "Heading 2", "Een dagje Antwerpen"],
  ["text-h3 font-display", "Heading 3", "Een dagje Antwerpen"],
  ["text-title font-display", "Title", "Een dagje Antwerpen"],
  ["text-term font-display", "Knowledge term", "rekening houden met"],
  ["text-quiz font-sans", "Quiz question", "Wat betekent 'gezellig'?"],
  ["text-body-lg font-sans", "Body large", "We gingen af en toe naar Antwerpen."],
  ["text-body font-sans", "Body", "We gingen af en toe naar Antwerpen."],
  ["text-body-sm font-sans", "Body small", "We gingen af en toe naar Antwerpen."],
  ["text-label font-sans uppercase", "Label", "Woordsoort"],
  ["text-caption font-sans", "Caption", "Toegevoegd door Sofie · 2 sep 2026"],
  ["text-reading font-reading", "Reading body (Lora)", "'s Middags spraken we af bij het station."],
] as const;

function Swatch({ className, name }: { className: string; name: string }) {
  return (
    <div className="space-y-1.5">
      <div className={`h-14 rounded-md ${className}`} />
      <p className="text-caption text-fg-muted">{name}</p>
    </div>
  );
}

export default async function FoundationPage() {
  const t = await getTranslations("foundation");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-12">
        <Section title="Kleur — oppervlakken">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {SURFACES.map(([c, n]) => (
              <Swatch key={n} className={c} name={n} />
            ))}
          </div>
        </Section>

        <Section title="Kleur — accenten & feedback">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {ACCENTS.map(([c, n]) => (
              <Swatch key={n} className={c} name={n} />
            ))}
          </div>
        </Section>

        <Section title="Kleur — kennistypes">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {KNOWLEDGE.map(([c, n]) => (
              <Swatch key={n} className={c} name={n} />
            ))}
          </div>
        </Section>

        <Section title="Typografie">
          <div className="divide-y divide-border rounded-card border border-border bg-surface">
            {TYPE_SCALE.map(([cls, label, sample]) => (
              <div
                key={label}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="w-40 shrink-0 text-caption text-fg-muted">{label}</span>
                <span className={`${cls} text-fg`}>{sample}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Knoppen">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primair</Button>
            <Button variant="secondary">Secundair</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Verwijderen</Button>
            <Button disabled>Uitgeschakeld</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Klein</Button>
            <Button size="md">Middel</Button>
            <Button size="lg">Groot</Button>
            <Button iconLeft={<Plus className="size-[18px]" />}>Toevoegen</Button>
            <Button variant="ghost" iconRight={<ArrowRight className="size-[18px]" />}>
              Verder
            </Button>
            <IconButton aria-label="Markeer als geleerd" icon={<Check />} variant="secondary" />
            <IconButton aria-label="Lees verder" icon={<BookOpen />} />
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">128</Badge>
            <Badge tone="info">Nieuw</Badge>
            <Badge tone="success">Beheerst</Badge>
            <Badge tone="warning">Herhalen</Badge>
            <Badge tone="error">Fout</Badge>
            <Badge tone="vocabulary">B1</Badge>
            <Badge tone="grammar">A2</Badge>
            <Badge tone="reading">A2</Badge>
            <Badge tone="file">PDF</Badge>
          </div>
        </Section>

        <Section title="Radius & elevatie">
          <div className="flex flex-wrap gap-6">
            {[
              ["rounded-sm", "radius-sm"],
              ["rounded-md", "radius-md"],
              ["rounded-lg", "radius-lg"],
              ["rounded-card", "radius-card"],
              ["rounded-modal", "radius-modal"],
            ].map(([cls, name]) => (
              <div key={name} className="space-y-1.5">
                <div className={`size-20 border border-border bg-surface ${cls}`} />
                <p className="text-caption text-fg-muted">{name}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            {[
              ["shadow-card", "shadow-card"],
              ["shadow-elevated", "shadow-elevated"],
              ["shadow-modal", "shadow-modal"],
            ].map(([cls, name]) => (
              <div key={name} className="space-y-1.5">
                <div className={`size-20 rounded-card bg-surface ${cls}`} />
                <p className="text-caption text-fg-muted">{name}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
