-- =====================================================
-- LEXIA CRM - PostgreSQL Schema for Supabase
-- =====================================================
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE company_type AS ENUM ('PME', 'GE/ETI', 'Public Services');
CREATE TYPE entity_type AS ENUM ('client', 'partner');
CREATE TYPE partner_type AS ENUM ('technology', 'consulting', 'financial', 'legal', 'marketing', 'other');
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE pipeline_stage AS ENUM ('entry_point', 'exchange', 'proposal', 'validation', 'client_success');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'not_specified');
CREATE TYPE activity_type AS ENUM ('email', 'meeting', 'note', 'call');
CREATE TYPE direction_type AS ENUM ('inbound', 'outbound');
CREATE TYPE sync_status AS ENUM ('synced', 'pending', 'none');
CREATE TYPE document_type AS ENUM ('pdf', 'sheet', 'doc', 'slide', 'image', 'other');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE task_priority AS ENUM ('urgent', 'high', 'medium', 'low');

-- =====================================================
-- TABLES
-- =====================================================

-- Users (Lexia Team members who can login)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(100),
    last_login_date TIMESTAMPTZ,
    is_away BOOLEAN DEFAULT FALSE,
    return_date DATE,
    custom_app_logo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies (both clients and partners)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    type company_type NOT NULL DEFAULT 'PME',
    entity_type entity_type NOT NULL DEFAULT 'client',
    website VARCHAR(255),
    importance priority_level NOT NULL DEFAULT 'medium',
    pipeline_stage pipeline_stage NOT NULL DEFAULT 'entry_point',
    last_contact_date TIMESTAMPTZ DEFAULT NOW(),
    general_comment TEXT,
    -- Partner-specific fields
    partner_type partner_type,
    partner_since DATE,
    partner_agreement TEXT,
    commission_rate DECIMAL(5,2),
    referrals_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (people at companies)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    linkedin_url TEXT,
    is_main_contact BOOLEAN DEFAULT FALSE,
    gender gender_type DEFAULT 'not_specified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Emails (multiple emails per contact)
CREATE TABLE contact_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_id, email)
);

-- Company Team Members (Lexia team assigned to a company)
CREATE TABLE company_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- Activities (interactions with companies)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type activity_type NOT NULL DEFAULT 'note',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255), -- Fallback if user_id is null
    direction direction_type,
    sync_status sync_status DEFAULT 'none',
    stage_id pipeline_stage,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Items (pipeline progress tracking)
CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stage_id pipeline_stage NOT NULL,
    label VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, stage_id)
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type document_type NOT NULL DEFAULT 'other',
    url TEXT NOT NULL,
    added_by VARCHAR(255),
    added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    due_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Assignees (multiple people per task)
CREATE TABLE task_assignees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_companies_entity_type ON companies(entity_type);
CREATE INDEX idx_companies_pipeline_stage ON companies(pipeline_stage);
CREATE INDEX idx_companies_importance ON companies(importance);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contact_emails_contact_id ON contact_emails(contact_id);
CREATE INDEX idx_contact_emails_email ON contact_emails(email);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_date ON activities(date);
CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_task_assignees_user_id ON task_assignees(user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON checklist_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update company's last_contact_date when activity is added
CREATE OR REPLACE FUNCTION update_company_last_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE companies SET last_contact_date = NOW() WHERE id = NEW.company_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER activity_update_last_contact AFTER INSERT ON activities FOR EACH ROW EXECUTE FUNCTION update_company_last_contact();

-- Function to ensure only one main contact per company
CREATE OR REPLACE FUNCTION ensure_single_main_contact()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_main_contact = TRUE THEN
        UPDATE contacts SET is_main_contact = FALSE 
        WHERE company_id = NEW.company_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER contact_ensure_single_main AFTER INSERT OR UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION ensure_single_main_contact();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users - adjust as needed)
CREATE POLICY "Allow all for authenticated users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON contact_emails FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON company_team_members FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON checklist_items FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON task_assignees FOR ALL USING (true);

-- =====================================================
-- VIEWS (for easier querying)
-- =====================================================

-- View: Contacts with emails array
CREATE OR REPLACE VIEW contacts_with_emails AS
SELECT 
    c.*,
    COALESCE(array_agg(ce.email) FILTER (WHERE ce.email IS NOT NULL), '{}') as emails
FROM contacts c
LEFT JOIN contact_emails ce ON c.id = ce.contact_id
GROUP BY c.id;

-- View: Companies with full details
CREATE OR REPLACE VIEW companies_full AS
SELECT 
    co.*,
    (
        SELECT json_agg(json_build_object(
            'id', ct.id,
            'name', ct.name,
            'role', ct.role,
            'phone', ct.phone,
            'avatarUrl', ct.avatar_url,
            'linkedinUrl', ct.linkedin_url,
            'isMainContact', ct.is_main_contact,
            'gender', ct.gender,
            'emails', (SELECT COALESCE(array_agg(ce.email), '{}') FROM contact_emails ce WHERE ce.contact_id = ct.id)
        ))
        FROM contacts ct WHERE ct.company_id = co.id
    ) as contacts,
    (
        SELECT json_agg(json_build_object(
            'id', a.id,
            'type', a.type,
            'title', a.title,
            'description', a.description,
            'date', a.date,
            'user', COALESCE(u.name, a.user_name),
            'direction', a.direction,
            'syncStatus', a.sync_status,
            'stageId', a.stage_id
        ) ORDER BY a.date DESC)
        FROM activities a 
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.company_id = co.id
    ) as activities,
    (
        SELECT json_agg(json_build_object(
            'id', d.id,
            'name', d.name,
            'type', d.type,
            'url', d.url,
            'addedBy', COALESCE(u.name, d.added_by),
            'createdAt', d.created_at
        ) ORDER BY d.created_at DESC)
        FROM documents d
        LEFT JOIN users u ON d.added_by_user_id = u.id
        WHERE d.company_id = co.id
    ) as documents,
    (
        SELECT json_agg(json_build_object(
            'id', u.id,
            'name', u.name,
            'role', ctm.role,
            'avatarUrl', u.avatar_url,
            'email', u.email
        ))
        FROM company_team_members ctm
        JOIN users u ON ctm.user_id = u.id
        WHERE ctm.company_id = co.id
    ) as team,
    (
        SELECT json_agg(json_build_object(
            'id', ci.stage_id,
            'label', ci.label,
            'completed', ci.completed,
            'notes', ci.notes
        ) ORDER BY 
            CASE ci.stage_id 
                WHEN 'entry_point' THEN 1 
                WHEN 'exchange' THEN 2 
                WHEN 'proposal' THEN 3 
                WHEN 'validation' THEN 4 
                WHEN 'client_success' THEN 5 
            END
        )
        FROM checklist_items ci WHERE ci.company_id = co.id
    ) as checklist
FROM companies co;
