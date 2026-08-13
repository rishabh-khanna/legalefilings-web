-- User Activity Logging System
-- Comprehensive tracking of user sessions, logins, page views, and actions
-- For platform admin/super user analytics and audit trails

-- ============================================================================
-- 1. User Sessions Table
-- ============================================================================
-- Tracks individual login sessions with device/browser info
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Session metadata
  session_start timestamptz NOT NULL DEFAULT now(),
  session_end timestamptz,
  last_activity timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  
  -- Device & location info
  ip_address inet,
  user_agent text,
  device_type text, -- 'desktop', 'mobile', 'tablet'
  browser text,
  os text,
  country text,
  city text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_organization_id ON user_sessions(organization_id);
CREATE INDEX idx_user_sessions_session_start ON user_sessions(session_start DESC);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = true;

COMMENT ON TABLE user_sessions IS 'Tracks user login sessions with device info and duration';

-- ============================================================================
-- 2. Activity Logs Table
-- ============================================================================
-- Tracks all user actions and page views
CREATE TYPE activity_category AS ENUM (
  'auth',           -- login, logout, password change
  'navigation',     -- page views, route changes
  'crm',           -- lead/order/customer operations
  'invoice',       -- invoice creation, editing, payment
  'hrms',          -- attendance, leave, payroll actions
  'finance',       -- expense tracking, budget operations
  'admin',         -- admin panel operations
  'settings',      -- profile/org settings changes
  'document',      -- file uploads/downloads
  'export'         -- CSV/PDF exports
);

CREATE TYPE activity_action AS ENUM (
  -- Generic CRUD
  'create', 'read', 'update', 'delete',
  
  -- Navigation
  'page_view', 'search',
  
  -- Auth
  'login', 'logout', 'login_failed',
  
  -- CRM specific
  'lead_created', 'lead_updated', 'lead_converted', 'lead_assigned',
  'order_created', 'order_updated', 'order_assigned', 'order_completed',
  'invoice_created', 'invoice_sent', 'invoice_paid', 'invoice_reminded',
  
  -- HRMS specific
  'clock_in', 'clock_out', 'leave_requested', 'leave_approved', 'leave_rejected',
  'payslip_generated', 'attendance_corrected',
  
  -- Finance specific
  'transaction_added', 'budget_set', 'bill_paid',
  
  -- Documents
  'file_uploaded', 'file_downloaded', 'file_deleted',
  
  -- Exports
  'csv_exported', 'pdf_generated'
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Activity details
  category activity_category NOT NULL,
  action activity_action NOT NULL,
  description text,
  
  -- Context
  page_path text, -- e.g., '/dashboard/crm/leads'
  page_title text,
  referrer text,
  
  -- Target entity (what was acted upon)
  entity_type text, -- 'lead', 'order', 'invoice', 'user', etc.
  entity_id uuid,
  entity_name text, -- Human-readable name for display
  
  -- Additional metadata (JSON for flexibility)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Performance tracking
  duration_ms integer, -- How long the action took
  
  -- IP for audit (denormalized from session for quick access)
  ip_address inet,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_organization_id ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_session_id ON activity_logs(session_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_category ON activity_logs(category);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_metadata ON activity_logs USING GIN (metadata);

COMMENT ON TABLE activity_logs IS 'Comprehensive log of all user actions and page views';

-- ============================================================================
-- 3. Login History View (Quick Access)
-- ============================================================================
-- Materialized view for fast login analytics
CREATE VIEW login_history AS
SELECT 
  al.user_id,
  al.organization_id,
  p.full_name,
  p.email,
  p.account_type,
  al.created_at as login_time,
  al.ip_address,
  al.metadata->>'user_agent' as user_agent,
  al.metadata->>'device_type' as device_type,
  al.session_id,
  CASE 
    WHEN al.action = 'login_failed' THEN false
    ELSE true
  END as success
FROM activity_logs al
JOIN profiles p ON p.id = al.user_id
WHERE al.category = 'auth' AND al.action IN ('login', 'login_failed')
ORDER BY al.created_at DESC;

COMMENT ON VIEW login_history IS 'Quick access view for login attempts and success/failure';

-- ============================================================================
-- 4. Daily Active Users View
-- ============================================================================
CREATE VIEW daily_active_users AS
SELECT 
  DATE(created_at) as activity_date,
  organization_id,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_actions
FROM activity_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), organization_id
ORDER BY activity_date DESC;

COMMENT ON VIEW daily_active_users IS 'Daily active user counts per organization';

-- ============================================================================
-- 5. Popular Pages View
-- ============================================================================
CREATE VIEW popular_pages AS
SELECT 
  organization_id,
  page_path,
  page_title,
  COUNT(*) as view_count,
  COUNT(DISTINCT user_id) as unique_visitors,
  AVG(duration_ms) as avg_duration_ms
FROM activity_logs
WHERE category = 'navigation' 
  AND action = 'page_view'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY organization_id, page_path, page_title
ORDER BY view_count DESC;

COMMENT ON VIEW popular_pages IS 'Most visited pages in the last 7 days';

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

-- Platform admins can see all activity across all orgs
-- Organization admins can only see their org's activity
-- Regular users cannot access activity logs directly

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Platform admin: see everything
CREATE POLICY "Platform admins see all sessions"
  ON user_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Platform admins see all activity"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Org admins: see their org only
CREATE POLICY "Org admins see their org sessions"
  ON user_sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

CREATE POLICY "Org admins see their org activity"
  ON activity_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.account_type = 'admin'
    )
  );

-- Allow system to insert activity (no RLS on INSERT)
CREATE POLICY "System can insert sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert activity"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Allow system to update sessions (for session_end, last_activity)
CREATE POLICY "System can update sessions"
  ON user_sessions FOR UPDATE
  USING (true);

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration(session_uuid uuid)
RETURNS interval AS $$
BEGIN
  RETURN (
    SELECT session_end - session_start
    FROM user_sessions
    WHERE id = session_uuid
    AND session_end IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get active sessions count
CREATE OR REPLACE FUNCTION get_active_sessions_count(org_id uuid DEFAULT NULL)
RETURNS integer AS $$
BEGIN
  IF org_id IS NULL THEN
    RETURN (SELECT COUNT(*) FROM user_sessions WHERE is_active = true);
  ELSE
    RETURN (SELECT COUNT(*) FROM user_sessions WHERE is_active = true AND organization_id = org_id);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to end inactive sessions (called by cron)
CREATE OR REPLACE FUNCTION end_inactive_sessions(inactive_minutes integer DEFAULT 60)
RETURNS integer AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE user_sessions
  SET 
    is_active = false,
    session_end = last_activity,
    updated_at = now()
  WHERE is_active = true
    AND last_activity < (now() - (inactive_minutes || ' minutes')::interval);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION end_inactive_sessions IS 'Automatically ends sessions that have been inactive for specified minutes';

-- ============================================================================
-- 8. Triggers
-- ============================================================================

-- Auto-update session last_activity on new activity log
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS trigger AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE user_sessions
    SET 
      last_activity = NEW.created_at,
      updated_at = NEW.created_at
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
