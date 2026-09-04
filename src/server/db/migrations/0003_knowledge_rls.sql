-- Row Level Security (defense-in-depth; the service layer is the primary guard)
ALTER TABLE "knowledge_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_items_select_member" ON "knowledge_items"
  FOR SELECT TO authenticated USING (
    group_id IN (SELECT group_id FROM group_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "knowledge_items_insert_member" ON "knowledge_items"
  FOR INSERT TO authenticated WITH CHECK (
    group_id IN (SELECT group_id FROM group_memberships WHERE user_id = auth.uid())
  );
