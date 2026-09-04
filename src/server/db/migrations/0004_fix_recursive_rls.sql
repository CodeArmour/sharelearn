-- Fix infinite recursion in RLS policies that subquery group_memberships from
-- within a policy attached to group_memberships itself. Postgres evaluates a
-- table's RLS policies on every access to that table -- including when the
-- policy's own subquery reads from the same table -- so a self-referencing
-- subquery on group_memberships recurses forever (error 42P17). This was
-- invisible in the app because it always connects as the table owner, which
-- bypasses RLS; an RLS smoke test running as `authenticated` hits it on the
-- very first query.
--
-- Fix: move the membership/ownership check into a SECURITY DEFINER function.
-- Such a function executes with its owner's privileges (the table owner,
-- who bypasses RLS by default), so its internal query against
-- group_memberships never re-triggers that table's own policy -- breaking
-- the cycle. Every policy that previously subqueried group_memberships
-- directly is rewritten to call these functions instead, for both
-- correctness and consistency.

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_id = p_group_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

DROP POLICY "groups_select_member" ON "groups";
CREATE POLICY "groups_select_member" ON "groups"
  FOR SELECT TO authenticated USING (is_group_member(id));

DROP POLICY "memberships_select_member" ON "group_memberships";
CREATE POLICY "memberships_select_member" ON "group_memberships"
  FOR SELECT TO authenticated USING (is_group_member(group_id));

DROP POLICY "invitations_all_owner" ON "invitations";
CREATE POLICY "invitations_all_owner" ON "invitations"
  FOR ALL TO authenticated USING (is_group_owner(group_id));

DROP POLICY "knowledge_items_select_member" ON "knowledge_items";
CREATE POLICY "knowledge_items_select_member" ON "knowledge_items"
  FOR SELECT TO authenticated USING (is_group_member(group_id));

DROP POLICY "knowledge_items_insert_member" ON "knowledge_items";
CREATE POLICY "knowledge_items_insert_member" ON "knowledge_items"
  FOR INSERT TO authenticated WITH CHECK (is_group_member(group_id));
