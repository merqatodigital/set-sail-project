-- =============================================================
-- CLEANUP: Drop unused tala_knowledge, auto-purge briefings
-- Run in Supabase SQL Editor
-- =============================================================

-- 1. Drop the old knowledge table (now handled by dynamic CMS data)
DROP TABLE IF EXISTS tala_knowledge CASCADE;

-- 2. Auto-purge briefings older than 30 days
CREATE OR REPLACE FUNCTION purge_old_briefings()
RETURNS void AS $$
BEGIN
  DELETE FROM tala_briefings WHERE generated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Auto-purge old audit log entries (keep only 30 days)
CREATE OR REPLACE FUNCTION purge_old_audit_log()
RETURNS void AS $$
BEGIN
  DELETE FROM tala_audit_log WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 4. Auto-purge old proactive messages (keep only 14 days)
CREATE OR REPLACE FUNCTION purge_old_proactive_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM tala_proactive_messages WHERE created_at < NOW() - INTERVAL '14 days' AND read = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Run initial cleanup now
SELECT purge_old_briefings();
SELECT purge_old_audit_log();
SELECT purge_old_proactive_messages();

-- 6. Optional: If you have pg_cron enabled, schedule automatic purges
-- Uncomment the lines below if pg_cron is installed:
-- SELECT cron.schedule('purge-briefings', '0 3 * * *', 'SELECT purge_old_briefings()');
-- SELECT cron.schedule('purge-audit-log', '0 3 * * *', 'SELECT purge_old_audit_log()');
-- SELECT cron.schedule('purge-proactive', '0 3 * * *', 'SELECT purge_old_proactive_messages()');
