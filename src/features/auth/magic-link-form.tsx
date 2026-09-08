"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { sendMagicLink, verifyMagicLinkCode } from "@/server/actions/auth";
import { Button, Input } from "@/components/ui";

type State =
  | { phase: "idle" }
  | { phase: "sent"; email: string }
  | { phase: "error" };

export function MagicLinkForm() {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const email = String(formData.get("email") ?? "");
      const res = await sendMagicLink(_prev, formData);
      return res.ok ? { phase: "sent", email } : { phase: "error" };
    },
    { phase: "idle" },
  );

  if (state.phase === "sent") {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <h1 className="font-display text-h2 text-fg">{t("sentTitle")}</h1>
          <p className="text-body-sm text-fg-muted">{t("sentBody", { email: state.email })}</p>
        </div>
        <CodeForm email={state.email} />
        <a href="/login" className="inline-block text-body-sm font-medium text-link hover:underline">
          {t("sentResend")}
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">{t("welcome")}</h1>
        <p className="text-body-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-body-sm font-medium text-fg-secondary">
          {t("emailLabel")}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
        />
      </div>
      {state.phase === "error" && (
        <p role="alert" className="text-body-sm text-error-strong">
          {t("errorGeneric")}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}

type CodeState = { phase: "idle" } | { phase: "error" };

/**
 * The alternative to clicking the emailed link: type the 6-digit code from the
 * same email. On success `verifyMagicLinkCode` sets the session cookie and
 * redirects into the app, so the action only returns here on failure.
 */
function CodeForm({ email }: { email: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState<CodeState, FormData>(
    async (_prev, formData) => {
      const res = await verifyMagicLinkCode(_prev, formData);
      return res.ok ? { phase: "idle" } : { phase: "error" };
    },
    { phase: "idle" },
  );

  return (
    <form action={formAction} className="space-y-3 border-t border-border pt-5">
      <input type="hidden" name="email" value={email} />
      <div className="space-y-1.5">
        <label htmlFor="code" className="text-body-sm font-medium text-fg-secondary">
          {t("codeLabel")}
        </label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder={t("codePlaceholder")}
        />
      </div>
      {state.phase === "error" && (
        <p role="alert" className="text-body-sm text-error-strong">
          {t("codeError")}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? t("verifying") : t("verifySubmit")}
      </Button>
    </form>
  );
}
