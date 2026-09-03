-- Custom SQL migration file, put your code below! --

-- Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

-- invitations.email is case-insensitive
ALTER TABLE "invitations" ALTER COLUMN "email" TYPE citext;

-- Row Level Security (defense-in-depth; the service layer is the primary guard)
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON "profiles"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "groups_select_member" ON "groups"
  FOR SELECT TO authenticated USING (
    id IN (SELECT group_id FROM group_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "memberships_select_member" ON "group_memberships"
  FOR SELECT TO authenticated USING (
    group_id IN (SELECT group_id FROM group_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "invitations_all_owner" ON "invitations"
  FOR ALL TO authenticated USING (
    group_id IN (
      SELECT group_id FROM group_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
