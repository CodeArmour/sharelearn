import type { NoteItem } from "@/types";

/** Full detail for a free-text note. The title (if any) is the page heading. */
export function NoteDetail({ item }: { item: NoteItem }) {
  return (
    <div className="font-reading text-reading whitespace-pre-line text-fg-secondary">
      {item.body}
    </div>
  );
}
