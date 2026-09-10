/**
 * Stable, non-cryptographic hash of a reading passage body. Used only to decide
 * whether a stored quiz was generated from the current text, so cosmetic edits
 * (re-wrapping, trailing spaces, capitalisation) must not change it: whitespace
 * runs collapse to one space and the text is lowercased first. cyrb53-style,
 * emitted as 16 hex chars.
 */
export function readingBodyHash(body: string): string {
  const normalized = body.trim().replace(/\s+/g, " ").toLowerCase();
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
  );
}
