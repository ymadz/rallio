-- Migration 047: Add admin SELECT policy for audit_logs
-- Allows global_admin and court_admin roles to read all audit log entries
-- (inserts are handled via service role in app code)

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      JOIN roles ON user_roles.role_id = roles.id
      WHERE user_roles.user_id = auth.uid()
        AND roles.name IN ('global_admin', 'court_admin')
    )
  );
