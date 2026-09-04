const ACCENTS = ["vocabulary", "grammar", "reading", "file"] as const;
export type Accent = (typeof ACCENTS)[number];

export function deriveInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : (parts[0] ?? local).slice(0, 2);
  return letters.toUpperCase().slice(0, 2);
}

export function deriveAccent(userId: string): Accent {
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}
