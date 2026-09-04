import { BrandMark } from "@/components/navigation/brand-mark";
import { InviteOutcome } from "@/features/auth/invite-outcome";
import type { InviteErrorCode } from "@/types";

const VALID_CODES: readonly InviteErrorCode[] = [
  "expired",
  "revoked",
  "email-mismatch",
  "already-member",
  "not-found",
];

function isInviteErrorCode(value: string | undefined): value is InviteErrorCode {
  return VALID_CODES.includes(value as InviteErrorCode);
}

/** Renders the error card the `[token]` route handler redirects to when
 * `acceptInvitation` fails. Never reached on success (that redirects straight
 * to `/today`). */
export default async function InviteOutcomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const safeCode: InviteErrorCode = isInviteErrorCode(code) ? code : "not-found";

  return (
    <div className="w-full max-w-sm space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
      <BrandMark />
      <InviteOutcome code={safeCode} />
    </div>
  );
}
