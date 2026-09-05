"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Pencil, Target, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useActiveGroup } from "@/lib/active-group";
import { useReviewMarks } from "@/lib/review-marks";
import { deleteKnowledgeItemAction } from "@/server/actions/knowledge";
import type { KnowledgeItem } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The things you can do with a knowledge item from its detail page: jump
 * into practice, flag it for review, or (author/owner only) edit or delete
 * it. Practice is only offered for the types that generate questions
 * (vocabulary, grammar, reading). Review marks are personal state, persisted
 * in `localStorage` until the backend exists, and shared with the Library
 * table and the Practice/Exam "review" scope.
 */
export function KnowledgeActions({
  item,
  practiseable,
}: {
  item: KnowledgeItem;
  practiseable: boolean;
}) {
  const t = useTranslations("knowledge.detail");
  const router = useRouter();
  const { user, membership } = useActiveGroup();
  const [marks, toggle] = useReviewMarks();
  const marked = marks.has(item.id);
  const canModify = item.addedBy.id === user.id || membership.role === "owner";
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    const result = await deleteKnowledgeItemAction(item.id);
    if (result.ok) {
      router.push("/library");
      return;
    }
    setDeleting(false);
    setDeleteError(true);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {practiseable ? (
          <Link href="/practice" className={buttonVariants({ variant: "primary", size: "md" })}>
            <Target className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
            {t("practise")}
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => toggle(item.id)}
          aria-pressed={marked}
          className={cn(
            buttonVariants({ variant: marked ? "secondary" : "outline", size: "md" }),
            marked && "text-knowledge-vocabulary-strong",
          )}
        >
          <Bookmark
            className="-ml-0.5 size-[18px]"
            strokeWidth={2}
            fill={marked ? "currentColor" : "none"}
            aria-hidden
          />
          {marked ? t("marked") : t("markReview")}
        </button>

        {canModify ? (
          <>
            <Link
              href={`/knowledge/${item.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              <Pencil className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
              {t("edit")}
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={buttonVariants({ variant: "danger", size: "md" })}
            >
              <Trash2 className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
              {t("delete")}
            </button>
          </>
        ) : null}
      </div>
      {deleteError ? (
        <p role="alert" className="text-danger text-body-sm">
          {t("deleteError")}
        </p>
      ) : null}
    </div>
  );
}
