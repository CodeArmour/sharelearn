-- Personal data (review marks, study runs): a user sees and writes only
-- their own rows, and only within a group they belong to. Reuses the
-- is_group_member() SECURITY DEFINER helper from 0004_fix_recursive_rls.sql,
-- so no new recursion surface. RLS is defense-in-depth; the personal-service
-- layer is the primary guard (the app connects as table owner).

ALTER TABLE "review_marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_runs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_marks_select_own" ON "review_marks"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_group_member(group_id));

CREATE POLICY "review_marks_insert_own" ON "review_marks"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_group_member(group_id));

CREATE POLICY "review_marks_delete_own" ON "review_marks"
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND is_group_member(group_id));

CREATE POLICY "study_runs_select_own" ON "study_runs"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_group_member(group_id));

CREATE POLICY "study_runs_insert_own" ON "study_runs"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_group_member(group_id));

-- No UPDATE or DELETE policy on study_runs: it is an append-only log.
