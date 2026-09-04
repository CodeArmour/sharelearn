-- Author-or-owner can edit or soft-delete a knowledge item. Delete is just a
-- special update (sets deleted_at), so one UPDATE policy covers both —
-- reuses the is_group_member/is_group_owner helpers from
-- 0004_fix_recursive_rls.sql, so there's no new recursion risk.
CREATE POLICY "knowledge_items_update_author_or_owner" ON "knowledge_items"
  FOR UPDATE TO authenticated
  USING (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)))
  WITH CHECK (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)));
