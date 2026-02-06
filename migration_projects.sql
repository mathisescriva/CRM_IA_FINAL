-- =====================================================
-- Migration: Projects system
-- Run: psql -d lexia_crm -f migration_projects.sql
-- =====================================================

-- 1. Create project_status enum
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    budget DECIMAL DEFAULT 0,
    spent DECIMAL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'EUR',
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    start_date DATE,
    end_date DATE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- 3. Create project_documents table (project drive)
CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'other',
    url TEXT NOT NULL,
    size_bytes BIGINT,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);

-- 4. Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'member',
    PRIMARY KEY (project_id, user_id)
);

-- 5. Add project_id to deals
DO $$ BEGIN
    ALTER TABLE deals ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_project ON deals(project_id);

-- 6. Add project_id to tasks
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- 7. Trigger for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Seed data: Sample projects
INSERT INTO projects (id, company_id, title, description, status, budget, spent, progress, start_date, end_date, owner_id)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    c.id,
    'Déploiement CRM 5 campus',
    'Déploiement de la solution CRM sur les 5 campus OMNES Education. Includes formation, migration de données et support.',
    'active',
    45000, 12000, 35,
    '2026-01-15', '2026-06-30',
    '11111111-1111-1111-1111-111111111111'
FROM companies c WHERE c.name ILIKE '%omnes%' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, company_id, title, description, status, budget, spent, progress, start_date, end_date, owner_id)
SELECT 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    c.id,
    'Licence IA Optimisation',
    'Licence annuelle de la solution IA pour optimisation des flux logistiques.',
    'active',
    24000, 20000, 85,
    '2025-06-01', '2026-05-31',
    '33333333-3333-3333-3333-333333333333'
FROM companies c WHERE c.name ILIKE '%vetoptim%' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, company_id, title, description, status, budget, spent, progress, start_date, end_date, owner_id)
SELECT 
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    c.id,
    'Gestion de flotte digitale',
    'POC pour la digitalisation de la gestion de flotte véhicules Gruau.',
    'planning',
    35000, 0, 10,
    '2026-03-01', '2026-09-30',
    '11111111-1111-1111-1111-111111111111'
FROM companies c WHERE c.name ILIKE '%gruau%' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Link existing deals to projects
UPDATE deals SET project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE title ILIKE '%CRM%campus%' OR title ILIKE '%OMNES%';
UPDATE deals SET project_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' WHERE title ILIKE '%IA%Optimisation%' OR title ILIKE '%vetoptim%';
UPDATE deals SET project_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' WHERE title ILIKE '%flotte%' OR title ILIKE '%gruau%';

-- Add project members
INSERT INTO project_members (project_id, user_id, role) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'member'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Add sample project documents
INSERT INTO project_documents (project_id, name, type, url, added_by) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Proposition commerciale v2.pdf', 'pdf', '#', '11111111-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cahier des charges.doc', 'doc', '#', '11111111-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planning migration.sheet', 'sheet', '#', '22222222-2222-2222-2222-222222222222'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Contrat licence 2025-2026.pdf', 'pdf', '#', '33333333-3333-3333-3333-333333333333'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Brief POC Gruau.pdf', 'pdf', '#', '11111111-1111-1111-1111-111111111111');

SELECT 'Projects migration completed!' AS result;
