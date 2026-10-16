-- User notification preferences per business
-- Created: 2026-09-27 (P0)
-- Idempotent: re-running is safe

-- UUID values are supplied by auth.users; this table needs no uuid extension.

-- Main table: one row per user per business
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- RLS: users only see their own preferences
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own prefs" ON user_notification_preferences;
CREATE POLICY "Users read own prefs" ON user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own prefs" ON user_notification_preferences;
CREATE POLICY "Users insert own prefs" ON user_notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own prefs" ON user_notification_preferences;
CREATE POLICY "Users update own prefs" ON user_notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trigger_user_notification_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER trigger_user_notification_preferences_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log integration (uses existing audit_logs table from migration 005)
-- No additional audit trigger needed; server code writes audit on preference change.