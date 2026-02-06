-- =====================================================
-- KONEKT CRM - Full Database Schema
-- Run this file to create/update all tables
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES (existing)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT 'user-' || substr(uuid_generate_v4()::text, 1, 8),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT lower(replace(uuid_generate_v4()::text, '-', '')),
    name TEXT NOT NULL,
    logo_url TEXT,
    type TEXT DEFAULT 'PME' CHECK (type IN ('PME', 'GE/ETI', 'Public Services')),
    entity_type TEXT DEFAULT 'client' CHECK (entity_type IN ('client', 'partner')),
    website TEXT,
    last_contact_date TIMESTAMPTZ DEFAULT NOW(),
    importance TEXT DEFAULT 'medium' CHECK (importance IN ('high', 'medium', 'low')),
    pipeline_stage TEXT DEFAULT 'entry_point',
    partner_type TEXT,
    partner_since DATE,
    partner_agreement TEXT,
    commission_rate DECIMAL,
    referrals_count INT DEFAULT 0,
    general_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY DEFAULT 'contact-' || substr(uuid_generate_v4()::text, 1, 8),
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    avatar_url TEXT,
    linkedin_url TEXT,
    is_main_contact BOOLEAN DEFAULT FALSE,
    gender TEXT DEFAULT 'not_specified',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_emails (
    id SERIAL PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT 'act-' || substr(uuid_generate_v4()::text, 1, 8),
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'note',
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    user_name TEXT,
    direction TEXT,
    sync_status TEXT DEFAULT 'none',
    stage_id TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY DEFAULT 'doc-' || substr(uuid_generate_v4()::text, 1, 8),
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'other',
    url TEXT,
    added_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_team_members (
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT,
    PRIMARY KEY (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS checklist_items (
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL,
    label TEXT,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    PRIMARY KEY (company_id, stage_id)
);

-- =====================================================
-- NEW: TASKS (migrated from localStorage)
-- =====================================================

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT 'task-' || substr(uuid_generate_v4()::text, 1, 8),
    title TEXT NOT NULL,
    description TEXT,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    company_name TEXT,
    assigned_by TEXT NOT NULL DEFAULT 'mathis',
    due_date TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly'
    recurrence_end_date TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignees (
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_comments (
    id TEXT PRIMARY KEY DEFAULT 'comment-' || substr(uuid_generate_v4()::text, 1, 8),
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NEW: TEAM ACTIVITY (migrated from localStorage)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_activity (
    id TEXT PRIMARY KEY DEFAULT 'act-' || substr(uuid_generate_v4()::text, 1, 8),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    target_name TEXT,
    description TEXT,
    mentioned_users TEXT[] DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NEW: NOTIFICATIONS (migrated from localStorage)
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT 'notif-' || substr(uuid_generate_v4()::text, 1, 8),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NEW: DEALS / OPPORTUNITIES
-- =====================================================

CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY DEFAULT 'deal-' || substr(uuid_generate_v4()::text, 1, 8),
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value DECIMAL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    probability INT DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
    stage TEXT DEFAULT 'qualification' CHECK (stage IN ('qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    expected_close_date DATE,
    owner_id TEXT NOT NULL DEFAULT 'mathis',
    contact_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- =====================================================
-- NEW: EMAIL TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY DEFAULT 'tpl-' || substr(uuid_generate_v4()::text, 1, 8),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    variables TEXT[] DEFAULT '{}',
    created_by TEXT NOT NULL DEFAULT 'mathis',
    is_shared BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SEED DATA: Tasks
-- =====================================================

INSERT INTO tasks (id, title, company_id, company_name, assigned_by, due_date, priority, status)
VALUES 
    ('task-seed-1', 'Envoyer proposition commerciale', 'omnes-education', 'OMNES Education', 'martial', NOW(), 'high', 'pending'),
    ('task-seed-2', 'Appel de suivi contrat', 'vetoptim', 'Vetoptim', 'martial', NOW() + INTERVAL '1 day', 'high', 'pending'),
    ('task-seed-3', 'Préparer démo produit', 'gruau', 'Gruau', 'mathis', NOW() + INTERVAL '2 days', 'medium', 'in_progress')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_assignees (task_id, user_id)
VALUES 
    ('task-seed-1', 'mathis'),
    ('task-seed-2', 'martial'),
    ('task-seed-2', 'mathis'),
    ('task-seed-3', 'hugo'),
    ('task-seed-3', 'mathis')
ON CONFLICT (task_id, user_id) DO NOTHING;

-- =====================================================
-- SEED DATA: Team Activity
-- =====================================================

INSERT INTO team_activity (id, user_id, user_name, user_avatar, action, target_type, target_id, target_name, description)
VALUES
    ('act-seed-1', 'martial', 'Martial', '/martial.jpg', 'signed', 'deal', 'vetoptim', 'Vetoptim', 'Contrat signé - 24k/an'),
    ('act-seed-2', 'mathis', 'Mathis', '/mathis.jpg', 'contacted', 'company', 'omnes-education', 'OMNES Education', 'Envoi proposition v2'),
    ('act-seed-3', 'hugo', 'Hugo', '/hugo.jpg', 'created', 'contact', 'gruau', 'Jean-Marc Leroy', 'Nouveau contact chez Gruau'),
    ('act-seed-4', 'mathis', 'Mathis', '/mathis.jpg', 'mentioned', 'company', 'omnes-education', 'OMNES Education', '@Hugo peux-tu préparer la démo ?')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED DATA: Notifications
-- =====================================================

INSERT INTO notifications (id, user_id, type, title, message, link, read)
VALUES
    ('notif-seed-1', 'hugo', 'mention', 'Mathis vous a mentionné', 'Sur OMNES Education: "@Hugo peux-tu préparer la démo ?"', '/company/omnes-education', FALSE),
    ('notif-seed-2', 'mathis', 'task_assigned', 'Nouvelle tâche assignée', 'Martial vous a assigné: Envoyer proposition commerciale', '/company/omnes-education', FALSE)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED DATA: Deals
-- =====================================================

INSERT INTO deals (id, company_id, title, value, probability, stage, expected_close_date, owner_id, notes)
VALUES
    ('deal-seed-1', 'omnes-education', 'Déploiement CRM 5 campus', 45000, 60, 'proposal', '2026-03-15', 'mathis', 'Proposition envoyée, en attente retour'),
    ('deal-seed-2', 'vetoptim', 'Licence IA Optimisation', 24000, 90, 'negotiation', '2026-02-28', 'martial', 'Contrat en cours de signature'),
    ('deal-seed-3', 'gruau', 'Gestion de flotte digitale', 35000, 30, 'qualification', '2026-04-30', 'mathis', 'Premier contact établi, besoin identifié')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED DATA: Email Templates
-- =====================================================

INSERT INTO email_templates (id, name, subject, body, category, variables, created_by)
VALUES
    ('tpl-seed-1', 'Relance prospect', 'Suite à notre échange - {company}', E'Bonjour {contact},\n\nJe me permets de revenir vers vous suite à notre dernier échange concernant {company}.\n\nJe souhaitais savoir si vous aviez eu le temps d''étudier notre proposition et si vous aviez des questions.\n\nJe reste à votre disposition pour en discuter.\n\nCordialement,\n{sender}', 'followup', '{contact,company,sender}', 'mathis'),
    ('tpl-seed-2', 'Envoi de proposition', 'Proposition commerciale - {company}', E'Bonjour {contact},\n\nSuite à notre discussion, veuillez trouver ci-joint notre proposition commerciale adaptée aux besoins de {company}.\n\nLes points clés :\n- {key_points}\n\nJe reste disponible pour toute question.\n\nCordialement,\n{sender}', 'proposal', '{contact,company,sender,key_points}', 'mathis'),
    ('tpl-seed-3', 'Prise de contact', 'Introduction - {sender_company}', E'Bonjour {contact},\n\nJe suis {sender} de {sender_company}. Nous aidons les entreprises comme {company} à optimiser leur gestion client.\n\nSeriez-vous disponible pour un échange de 15 minutes cette semaine ?\n\nCordialement,\n{sender}', 'introduction', '{contact,company,sender,sender_company}', 'mathis'),
    ('tpl-seed-4', 'Remerciement après réunion', 'Suite à notre réunion - {company}', E'Bonjour {contact},\n\nMerci pour le temps que vous nous avez accordé aujourd''hui.\n\nComme discuté, voici les prochaines étapes :\n- {next_steps}\n\nN''hésitez pas si vous avez des questions.\n\nCordialement,\n{sender}', 'meeting', '{contact,company,sender,next_steps}', 'mathis'),
    ('tpl-seed-5', 'Signature de contrat', 'Bienvenue chez {sender_company} !', E'Bonjour {contact},\n\nNous sommes ravis de vous compter parmi nos clients !\n\nVotre accès sera configuré sous 48h. Notre équipe Customer Success vous contactera pour planifier l''onboarding.\n\nBienvenue !\n\n{sender}', 'onboarding', '{contact,sender,sender_company}', 'mathis')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_timestamp ON team_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
