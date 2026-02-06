-- =====================================================
-- Migration: Create missing tables for full CRM features
-- Run: psql -d lexia_crm -f migration.sql
-- =====================================================

-- =====================================================
-- 1. TEAM ACTIVITY
-- =====================================================
CREATE TABLE IF NOT EXISTS team_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_avatar TEXT,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id TEXT,
    target_name TEXT,
    description TEXT,
    mentioned_users TEXT[] DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_timestamp ON team_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity(user_id);

-- =====================================================
-- 2. NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- =====================================================
-- 3. DEALS / OPPORTUNITIES
-- =====================================================

-- Create deal_stage enum
DO $$ BEGIN
    CREATE TYPE deal_stage AS ENUM ('qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    value DECIMAL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    probability INT DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
    stage deal_stage DEFAULT 'qualification',
    expected_close_date DATE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    contact_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);

-- =====================================================
-- 4. EMAIL TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    variables TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- =====================================================
-- 5. TASK COMMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- =====================================================
-- 6. Add triggers for updated_at on new tables
-- =====================================================
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. SEED DATA
-- =====================================================

-- Seed team activity
INSERT INTO team_activity (user_id, user_name, user_avatar, action, target_type, target_name, description)
SELECT u.id, 'Martial', '/martial.jpg', 'signed', 'deal', 'Vetoptim', 'Contrat signé - 24k/an'
FROM users u WHERE u.name ILIKE '%martial%' LIMIT 1;

INSERT INTO team_activity (user_id, user_name, user_avatar, action, target_type, target_name, description)
SELECT u.id, 'Mathis', '/mathis.jpg', 'contacted', 'company', 'OMNES Education', 'Envoi proposition v2'
FROM users u WHERE u.name ILIKE '%mathis%' LIMIT 1;

-- Seed notifications
INSERT INTO notifications (user_id, type, title, message, read)
SELECT u.id, 'info', 'Bienvenue sur Konekt CRM', 'Votre CRM est prêt à utiliser !', FALSE
FROM users u LIMIT 1;

-- Done!
SELECT 'Migration completed successfully!' AS result;
