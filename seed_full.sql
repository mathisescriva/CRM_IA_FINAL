-- =====================================================
-- LEXIA CRM - FULL SEED DATA FOR TESTING
-- All IDs are UUID format. Enums: task_status={todo,in_progress,done}, task_priority={urgent,high,medium,low}
-- =====================================================

-- Add mentions column to task_comments if missing
DO $$ BEGIN ALTER TABLE task_comments ADD COLUMN mentions TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Add stage/probability/expected_close_date to projects if missing
DO $$ BEGIN ALTER TABLE projects ADD COLUMN stage TEXT DEFAULT 'qualification'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects ADD COLUMN probability INT DEFAULT 50; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE projects ADD COLUMN expected_close_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =====================================================
-- 0. USERS (required for foreign keys)
-- =====================================================
INSERT INTO users (id, email, name, avatar_url, role, last_login_date, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'mathis@lexia.fr', 'Mathis', '/mathis.jpg', 'Account Executive', NOW(), NOW() - INTERVAL '90 days'),
    ('22222222-2222-2222-2222-222222222222', 'hugo@lexia.fr', 'Hugo', '/hugo.jpg', 'Customer Success Manager', NOW() - INTERVAL '1 day', NOW() - INTERVAL '90 days'),
    ('33333333-3333-3333-3333-333333333333', 'martial@lexia.fr', 'Martial', '/martial.jpg', 'Sales Director', NOW() - INTERVAL '2 days', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 1. NEW COMPANIES
-- =====================================================
INSERT INTO companies (id, name, type, entity_type, importance, pipeline_stage, website, logo_url, last_contact_date, general_comment, created_at)
VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', 'Datapulse', 'PME', 'client', 'high', 'exchange', 'datapulse.io', 'https://ui-avatars.com/api/?name=DP&background=6366f1&color=fff&size=128&bold=true', NOW() - INTERVAL '3 days', 'Scale-up data analytics. Recherche CRM intégré à leur stack data. Très réactif.', NOW() - INTERVAL '30 days'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'GreenTech Solutions', 'PME', 'client', 'medium', 'proposal', 'greentech-solutions.fr', 'https://ui-avatars.com/api/?name=GT&background=10b981&color=fff&size=128&bold=true', NOW() - INTERVAL '5 days', 'Startup cleantech. Budget modeste mais potentiel fort.', NOW() - INTERVAL '45 days'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Medianova', 'GE/ETI', 'client', 'high', 'validation', 'medianova.com', 'https://ui-avatars.com/api/?name=MN&background=f59e0b&color=fff&size=128&bold=true', NOW() - INTERVAL '1 day', 'Groupe média 12 filiales. Deal en phase finale. 65k€ validé au COMEX.', NOW() - INTERVAL '60 days'),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'NordLogistic', 'GE/ETI', 'client', 'medium', 'entry_point', 'nordlogistic.eu', 'https://ui-avatars.com/api/?name=NL&background=64748b&color=fff&size=128&bold=true', NOW() - INTERVAL '18 days', 'Logisticien européen. Premier contact via Accenture.', NOW() - INTERVAL '20 days'),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'UrbanCraft', 'PME', 'client', 'low', 'client_success', 'urbancraft.co', 'https://ui-avatars.com/api/?name=UC&background=8b5cf6&color=fff&size=128&bold=true', NOW() - INTERVAL '2 days', 'Client existant très satisfait. Potentiel upsell Q2.', NOW() - INTERVAL '180 days'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vetoptim', 'PME', 'client', 'high', 'client_success', 'vetoptim.fr', 'https://ui-avatars.com/api/?name=VO&background=ef4444&color=fff&size=128&bold=true', NOW() - INTERVAL '1 day', 'Plateforme vétérinaire leader. Client fidèle, renouvellement en cours.', NOW() - INTERVAL '200 days'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OMNES Education', 'GE/ETI', 'client', 'high', 'validation', 'omneseducation.com', 'https://ui-avatars.com/api/?name=OE&background=3b82f6&color=fff&size=128&bold=true', NOW() - INTERVAL '4 days', 'Groupe éducation supérieure. Déploiement multi-campus en cours.', NOW() - INTERVAL '120 days'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gruau', 'GE/ETI', 'client', 'medium', 'exchange', 'gruau.com', 'https://ui-avatars.com/api/?name=GR&background=f97316&color=fff&size=128&bold=true', NOW() - INTERVAL '10 days', 'Constructeur carrossier. Projet fleet management digital.', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. CONTACTS
-- =====================================================
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('ca111111-1111-1111-1111-111111111111', '11111111-aaaa-bbbb-cccc-111111111111', 'Lucas Bernard', 'CTO', '+33 6 55 44 33 22', TRUE, 'male'),
    ('ca222222-2222-2222-2222-222222222222', '11111111-aaaa-bbbb-cccc-111111111111', 'Émilie Roux', 'Head of Sales', '+33 6 11 22 33 44', FALSE, 'female'),
    ('ca333333-3333-3333-3333-333333333333', '22222222-aaaa-bbbb-cccc-222222222222', 'Antoine Moreau', 'CEO', '+33 6 77 88 99 00', TRUE, 'male'),
    ('ca444444-4444-4444-4444-444444444444', '33333333-aaaa-bbbb-cccc-333333333333', 'Nathalie Girard', 'Directrice Digitale', '+33 1 88 77 66 55', TRUE, 'female'),
    ('ca555555-5555-5555-5555-555555555555', '33333333-aaaa-bbbb-cccc-333333333333', 'Marc Fontaine', 'DAF', '+33 1 88 77 66 56', FALSE, 'male'),
    ('ca666666-6666-6666-6666-666666666666', '44444444-aaaa-bbbb-cccc-444444444444', 'Henrik Johansson', 'Procurement Director', '+46 70 123 45 67', TRUE, 'male'),
    ('ca777777-7777-7777-7777-777777777777', '55555555-aaaa-bbbb-cccc-555555555555', 'Julie Mercier', 'Operations Manager', '+33 6 99 88 77 66', TRUE, 'female'),
    ('ca888888-8888-8888-8888-888888888888', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dr. Claire Dumont', 'CEO & Fondatrice', '+33 6 12 34 56 78', TRUE, 'female'),
    ('ca999999-9999-9999-9999-999999999999', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Thomas Petit', 'Directeur Technique', '+33 6 22 33 44 55', FALSE, 'male'),
    ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sophie Martin', 'VP Transformation Digitale', '+33 1 45 67 89 00', TRUE, 'female'),
    ('cabbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pierre Leclerc', 'DSI', '+33 1 45 67 89 01', FALSE, 'male'),
    ('cacccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'François Dubois', 'Directeur Fleet Management', '+33 2 40 50 60 70', TRUE, 'male'),
    ('cadddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Isabelle Renard', 'Responsable IT', '+33 2 40 50 60 71', FALSE, 'female')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contact_emails (contact_id, email, is_primary) VALUES
    ('ca111111-1111-1111-1111-111111111111', 'lucas@datapulse.io', TRUE),
    ('ca222222-2222-2222-2222-222222222222', 'emilie.roux@datapulse.io', TRUE),
    ('ca333333-3333-3333-3333-333333333333', 'antoine@greentech-solutions.fr', TRUE),
    ('ca444444-4444-4444-4444-444444444444', 'n.girard@medianova.com', TRUE),
    ('ca555555-5555-5555-5555-555555555555', 'm.fontaine@medianova.com', TRUE),
    ('ca666666-6666-6666-6666-666666666666', 'henrik.johansson@nordlogistic.eu', TRUE),
    ('ca777777-7777-7777-7777-777777777777', 'julie.mercier@urbancraft.co', TRUE),
    ('ca888888-8888-8888-8888-888888888888', 'claire.dumont@vetoptim.fr', TRUE),
    ('ca999999-9999-9999-9999-999999999999', 'thomas.petit@vetoptim.fr', TRUE),
    ('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sophie.martin@omneseducation.com', TRUE),
    ('cabbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pierre.leclerc@omneseducation.com', TRUE),
    ('cacccccc-cccc-cccc-cccc-cccccccccccc', 'francois.dubois@gruau.com', TRUE),
    ('cadddddd-dddd-dddd-dddd-dddddddddddd', 'isabelle.renard@gruau.com', TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. TEAM ASSIGNMENTS
-- =====================================================
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('11111111-aaaa-bbbb-cccc-111111111111', '33333333-3333-3333-3333-333333333333', 'Sales Director'),
    ('22222222-aaaa-bbbb-cccc-222222222222', '22222222-2222-2222-2222-222222222222', 'Customer Success'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '33333333-3333-3333-3333-333333333333', 'Sales Director'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('44444444-aaaa-bbbb-cccc-444444444444', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('55555555-aaaa-bbbb-cccc-555555555555', '22222222-2222-2222-2222-222222222222', 'Customer Success'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Sales Director'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Customer Success'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Sales Director'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Customer Success')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. ACTIVITIES
-- =====================================================
INSERT INTO activities (company_id, type, title, description, date, user_name, direction, sync_status) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', 'meeting', 'Call découverte Datapulse', 'Présentation de la solution. Besoin CRM intégré avec stack data.', NOW() - INTERVAL '10 days', 'Mathis', NULL, 'synced'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'email', 'Envoi des use cases', 'Cas d''usage data/analytics envoyés.', NOW() - INTERVAL '5 days', 'Mathis', 'outbound', 'synced'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'call', 'Point technique CTO', 'Discussion API et intégrations stack technique.', NOW() - INTERVAL '3 days', 'Martial', 'outbound', 'synced'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'meeting', 'Démo GreenTech', 'Démonstration focus pipeline et reporting ESG.', NOW() - INTERVAL '8 days', 'Hugo', NULL, 'synced'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'email', 'Proposition envoyée', 'Offre startup 18k€/an avec accompagnement dédié.', NOW() - INTERVAL '5 days', 'Hugo', 'outbound', 'synced'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'meeting', 'Réunion stratégique Medianova', 'Présentation au COMEX. Budget 65k€ validé.', NOW() - INTERVAL '7 days', 'Martial', NULL, 'synced'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'email', 'Contrat en revue juridique', 'Juridique de Medianova revoit le contrat.', NOW() - INTERVAL '1 day', 'Martial', 'inbound', 'synced'),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'email', 'Introduction via Accenture', 'Mise en relation par Thomas Lefebvre avec Henrik.', NOW() - INTERVAL '18 days', 'Mathis', 'inbound', 'synced'),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'call', 'Review annuelle UrbanCraft', 'Client très satisfait. Intéressé par les fonctionnalités IA.', NOW() - INTERVAL '2 days', 'Hugo', 'outbound', 'synced'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'meeting', 'Point renouvellement Vetoptim', 'Discussion renouvellement + module prédictif avec Dr. Claire Dumont.', NOW() - INTERVAL '4 days', 'Martial', NULL, 'synced'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'email', 'Proposition upsell envoyée', 'Offre 32k€ avec module IA prédictif inclus.', NOW() - INTERVAL '2 days', 'Mathis', 'outbound', 'synced'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'meeting', 'Kick-off campus Paris', 'Lancement du déploiement CRM sur le campus de Paris avec Sophie Martin.', NOW() - INTERVAL '15 days', 'Mathis', NULL, 'synced'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'call', 'Point DSI Pierre Leclerc', 'Validation architecture technique multi-campus.', NOW() - INTERVAL '8 days', 'Mathis', 'outbound', 'synced'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'Planning Lyon envoyé', 'Planning détaillé pour le déploiement campus Lyon.', NOW() - INTERVAL '2 days', 'Hugo', 'outbound', 'synced'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'meeting', 'Découverte Gruau', 'Présentation solution fleet management à François Dubois.', NOW() - INTERVAL '10 days', 'Martial', NULL, 'synced'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'email', 'Business case ROI envoyé', 'Envoyé à Isabelle Renard avec projections sur 3 ans.', NOW() - INTERVAL '3 days', 'Hugo', 'outbound', 'synced')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. CHECKLIST ITEMS
-- =====================================================
INSERT INTO checklist_items (company_id, stage_id, label, completed, notes) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', 'entry_point', 'Premier Contact', TRUE, 'Via LinkedIn'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'exchange', 'En Discussion', TRUE, 'CRM + intégration data stack'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'proposal', 'Proposition', FALSE, ''),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'validation', 'Validation', FALSE, ''),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'client_success', 'Client Actif', FALSE, ''),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'entry_point', 'Premier Contact', TRUE, 'Salon cleantech'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'exchange', 'En Discussion', TRUE, ''),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'proposal', 'Proposition', TRUE, '18k€/an envoyée'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'validation', 'Validation', FALSE, ''),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'client_success', 'Client Actif', FALSE, ''),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'entry_point', 'Premier Contact', TRUE, 'Approche directe'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'exchange', 'En Discussion', TRUE, ''),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'proposal', 'Proposition', TRUE, '65k€ validé au COMEX'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'validation', 'Validation', TRUE, 'En revue juridique'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'client_success', 'Client Actif', FALSE, ''),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'entry_point', 'Premier Contact', TRUE, 'Via Accenture'),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'exchange', 'En Discussion', FALSE, ''),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'proposal', 'Proposition', FALSE, ''),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'validation', 'Validation', FALSE, ''),
    ('44444444-aaaa-bbbb-cccc-444444444444', 'client_success', 'Client Actif', FALSE, ''),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'entry_point', 'Premier Contact', TRUE, ''),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'exchange', 'En Discussion', TRUE, ''),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'proposal', 'Proposition', TRUE, ''),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'validation', 'Validation', TRUE, ''),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'client_success', 'Client Actif', TRUE, 'Actif depuis 6 mois')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. TASKS (UUID IDs, enum: todo/in_progress/done, urgent/high/medium/low)
-- =====================================================
INSERT INTO tasks (id, title, description, company_id, company_name, status, priority, due_date, created_by, created_at) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'Envoyer proposition Datapulse', 'Finaliser et envoyer la proposition commerciale à Lucas Bernard', '11111111-aaaa-bbbb-cccc-111111111111', 'Datapulse', 'todo', 'high', (NOW() - INTERVAL '1 day')::date, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '5 days'),
    ('a0000001-0000-0000-0000-000000000002', 'Relancer Nathalie Girard (Medianova)', 'Vérifier le retour du juridique sur le contrat', '33333333-aaaa-bbbb-cccc-333333333333', 'Medianova', 'todo', 'high', (NOW() - INTERVAL '2 days')::date, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '7 days'),
    ('a0000001-0000-0000-0000-000000000003', 'Préparer démo technique Datapulse', 'Slides API et cas d''usage data analytics', '11111111-aaaa-bbbb-cccc-111111111111', 'Datapulse', 'in_progress', 'high', NOW()::date, '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 days'),
    ('a0000001-0000-0000-0000-000000000004', 'Appel avec Antoine (GreenTech)', 'Point de suivi sur la proposition envoyée', '22222222-aaaa-bbbb-cccc-222222222222', 'GreenTech Solutions', 'todo', 'medium', NOW()::date, '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '2 days'),
    ('a0000001-0000-0000-0000-000000000005', 'Organiser onboarding UrbanCraft v2', 'Planifier la migration vers la nouvelle version', '55555555-aaaa-bbbb-cccc-555555555555', 'UrbanCraft', 'todo', 'medium', (NOW() + INTERVAL '3 days')::date, '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '1 day'),
    ('a0000001-0000-0000-0000-000000000006', 'Qualifier NordLogistic', 'Préparer le brief et planifier un premier call', '44444444-aaaa-bbbb-cccc-444444444444', 'NordLogistic', 'todo', 'low', (NOW() + INTERVAL '5 days')::date, '11111111-1111-1111-1111-111111111111', NOW()),
    ('a0000001-0000-0000-0000-000000000007', 'Rédiger étude de cas Vetoptim', 'Documenter le succès client pour le marketing', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vetoptim', 'in_progress', 'medium', (NOW() + INTERVAL '7 days')::date, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '4 days'),
    ('a0000001-0000-0000-0000-000000000008', 'Review contrat Medianova', 'Relire le contrat avant envoi final', '33333333-aaaa-bbbb-cccc-333333333333', 'Medianova', 'in_progress', 'high', (NOW() + INTERVAL '2 days')::date, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '2 days'),
    ('a0000001-0000-0000-0000-000000000009', 'Premier call Datapulse', 'Call de découverte avec Lucas Bernard', '11111111-aaaa-bbbb-cccc-111111111111', 'Datapulse', 'done', 'high', (NOW() - INTERVAL '10 days')::date, '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '15 days'),
    ('a0000001-0000-0000-0000-000000000010', 'Envoyer contrat Vetoptim', 'Envoyer le contrat final à Dr. Claire', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vetoptim', 'done', 'high', (NOW() - INTERVAL '5 days')::date, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_assignees (task_id, user_id) VALUES
    ('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333'),
    ('a0000001-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333'),
    ('a0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222'),
    ('a0000001-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222'),
    ('a0000001-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333'),
    ('a0000001-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222'),
    ('a0000001-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333'),
    ('a0000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111'),
    ('a0000001-0000-0000-0000-000000000010', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (task_id, user_id) DO NOTHING;

-- =====================================================
-- 7. TASK COMMENTS with @mentions (UUID IDs)
-- =====================================================
INSERT INTO task_comments (id, task_id, user_id, user_name, user_avatar, content, mentions, created_at) VALUES
    ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', '@Mathis peux-tu finaliser la proposition avant demain ? Le CTO attend notre retour.', ARRAY['11111111-1111-1111-1111-111111111111'], NOW() - INTERVAL '1 day'),
    ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Je m''en occupe cet aprem. Il faut intégrer les tarifs API.', '{}', NOW() - INTERVAL '12 hours'),
    ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Le juridique a posé des questions sur la clause de résiliation. @Mathis tu peux checker notre template ?', ARRAY['11111111-1111-1111-1111-111111111111'], NOW() - INTERVAL '6 hours'),
    ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', '@Hugo peux-tu me préparer 2-3 slides sur l''intégration data ? Tu connais bien leur stack.', ARRAY['22222222-2222-2222-2222-222222222222'], NOW() - INTERVAL '3 hours'),
    ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', '@Hugo tu peux demander les chiffres ROI à Claire pour l''étude de cas ?', ARRAY['22222222-2222-2222-2222-222222222222'], NOW() - INTERVAL '2 days'),
    ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'J''ai relu la partie commerciale. @Martial c''est bon pour toi côté conditions ?', ARRAY['33333333-3333-3333-3333-333333333333'], NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. PROJECTS
-- =====================================================
INSERT INTO projects (id, company_id, title, description, status, budget, spent, progress, start_date, end_date, owner_id, stage, probability, expected_close_date) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', '11111111-aaaa-bbbb-cccc-111111111111', 'Intégration CRM & Data Stack', 'Déploiement CRM avec connexion native BigQuery, dbt, Metabase. Enjeu stratégique.', 'active', 38000, 8500, 25, '2026-02-01', '2026-07-31', '11111111-1111-1111-1111-111111111111', 'proposal', 55, '2026-03-30'),
    ('22222222-aaaa-bbbb-cccc-222222222222', '22222222-aaaa-bbbb-cccc-222222222222', 'CRM Startup GreenTech', 'Solution CRM startup avec reporting ESG et suivi impact carbone.', 'planning', 18000, 0, 5, '2026-03-01', '2026-08-31', '22222222-2222-2222-2222-222222222222', 'proposal', 45, '2026-04-15'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '33333333-aaaa-bbbb-cccc-333333333333', 'Déploiement Groupe Medianova', 'CRM multi-filiales pour Medianova (12 entités). Contrat en validation juridique.', 'active', 65000, 15000, 45, '2026-01-15', '2026-09-30', '33333333-3333-3333-3333-333333333333', 'negotiation', 80, '2026-03-01'),
    ('55555555-aaaa-bbbb-cccc-555555555555', '55555555-aaaa-bbbb-cccc-555555555555', 'Maintenance & Support UrbanCraft', 'Support annuel et évolutions mineures. Client très satisfait.', 'completed', 12000, 12000, 100, '2025-06-01', '2026-05-31', '22222222-2222-2222-2222-222222222222', 'closed_won', 100, '2025-06-01'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Déploiement CRM 5 campus', 'CRM multi-campus pour OMNES Education. Phase de déploiement.', 'active', 45000, 16000, 35, '2026-01-01', '2026-06-30', '11111111-1111-1111-1111-111111111111', 'proposal', 60, '2026-03-15'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Licence IA Optimisation Vetoptim', 'Renouvellement licence IA prédictive vétérinaire + module nouveau.', 'active', 24000, 10000, 55, '2025-09-01', '2026-05-31', '33333333-3333-3333-3333-333333333333', 'negotiation', 90, '2026-02-28'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gestion de flotte digitale Gruau', 'Solution fleet management et suivi maintenance pour Gruau.', 'planning', 20000, 2000, 10, '2026-03-01', '2026-09-30', '33333333-3333-3333-3333-333333333333', 'qualification', 30, '2026-04-30')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. PROJECT MEMBERS
-- =====================================================
INSERT INTO project_members (project_id, user_id, role) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('11111111-aaaa-bbbb-cccc-111111111111', '33333333-3333-3333-3333-333333333333', 'member'),
    ('22222222-aaaa-bbbb-cccc-222222222222', '22222222-2222-2222-2222-222222222222', 'owner'),
    ('22222222-aaaa-bbbb-cccc-222222222222', '11111111-1111-1111-1111-111111111111', 'member'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '33333333-3333-3333-3333-333333333333', 'owner'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '11111111-1111-1111-1111-111111111111', 'member'),
    ('33333333-aaaa-bbbb-cccc-333333333333', '22222222-2222-2222-2222-222222222222', 'member'),
    ('55555555-aaaa-bbbb-cccc-555555555555', '22222222-2222-2222-2222-222222222222', 'owner'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'member'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'owner'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Link tasks to projects
UPDATE tasks SET project_id = '11111111-aaaa-bbbb-cccc-111111111111' WHERE id IN ('a0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000009');
UPDATE tasks SET project_id = '33333333-aaaa-bbbb-cccc-333333333333' WHERE id IN ('a0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000008');
UPDATE tasks SET project_id = '22222222-aaaa-bbbb-cccc-222222222222' WHERE id = 'a0000001-0000-0000-0000-000000000004';
UPDATE tasks SET project_id = '55555555-aaaa-bbbb-cccc-555555555555' WHERE id = 'a0000001-0000-0000-0000-000000000005';
UPDATE tasks SET project_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' WHERE id IN ('a0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000010');

-- =====================================================
-- 10. PROJECT NOTES with @mentions (UUID IDs)
-- =====================================================
INSERT INTO project_notes (id, project_id, user_id, user_name, user_avatar, content, mentions, note_type, created_at) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'La DSI d''OMNES a validé l''architecture technique. On peut passer au déploiement campus par campus.', '{}', 'message', NOW() - INTERVAL '5 days'),
    ('c0000001-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', '@Mathis Sophie Martin demande un planning détaillé pour le campus de Lyon. Tu peux le préparer ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '3 days'),
    ('c0000001-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Planning Lyon envoyé. @Hugo peux-tu coordonner le kick-off avec Sophie ?', ARRAY['22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '2 days'),
    ('c0000001-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Vetoptim veut ajouter un module prédictif. @Mathis on peut intégrer ça dans le renouvellement ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '4 days'),
    ('c0000001-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Oui, je vais chiffrer le module prédictif. Ça pourrait justifier un upsell à 32k€.', '{}', 'message', NOW() - INTERVAL '3 days'),
    ('c0000001-0000-0000-0000-000000000006', '11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Premier call avec Lucas très positif. Stack moderne (BigQuery + dbt). Notre intégration sera un vrai différenciateur.', '{}', 'message', NOW() - INTERVAL '8 days'),
    ('c0000001-0000-0000-0000-000000000007', '11111111-aaaa-bbbb-cccc-111111111111', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', '@Mathis le CTO veut voir une démo API avant de valider le budget. Tu peux organiser ça rapidement ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '2 days'),
    ('c0000001-0000-0000-0000-000000000008', '33333333-aaaa-bbbb-cccc-333333333333', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Le COMEX a validé 65k€. Notre plus gros deal en cours. @Mathis @Hugo on doit être irréprochables.', ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '6 days'),
    ('c0000001-0000-0000-0000-000000000009', '33333333-aaaa-bbbb-cccc-333333333333', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Juridique pose questions sur clause de résiliation. @Martial tu gères avec notre cabinet ?', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '1 day'),
    ('c0000001-0000-0000-0000-000000000010', '22222222-aaaa-bbbb-cccc-222222222222', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'Antoine est enthousiaste sur le module ESG. @Mathis peut-on l''intégrer sans surcoût ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '4 days'),
    -- Projet Datapulse — discussion technique
    ('c0000001-0000-0000-0000-000000000011', '11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'La démo API est prête. J''ai intégré les endpoints BigQuery et dbt. @Martial tu valides le pricing avant que j''envoie ?', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '1 day'),
    ('c0000001-0000-0000-0000-000000000012', '11111111-aaaa-bbbb-cccc-111111111111', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Pricing validé. On reste sur 38k€ avec accompagnement 3 mois. Envoie la démo à Lucas dès que possible.', '{}', 'message', NOW() - INTERVAL '18 hours'),
    -- Projet OMNES — suivi déploiement
    ('c0000001-0000-0000-0000-000000000013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Le campus de Paris est live ! Retours très positifs de Sophie. @Hugo tu peux lancer la formation utilisateurs Lyon semaine prochaine ?', ARRAY['22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '1 day'),
    ('c0000001-0000-0000-0000-000000000014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'C''est noté, je planifie Lyon pour mardi. @Martial on devrait pitcher l''extension aux 3 autres campus maintenant que Paris tourne bien.', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '12 hours'),
    -- Projet Vetoptim — négociation
    ('c0000001-0000-0000-0000-000000000015', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Le module prédictif est chiffré à 8k€ en plus. Total renouvellement + upsell = 32k€. @Martial ça te va comme offre ?', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '2 days'),
    ('c0000001-0000-0000-0000-000000000016', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Parfait, envoie la proposition à Claire. @Hugo tu peux préparer le plan d''accompagnement pour le module IA ?', ARRAY['22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '1 day'),
    -- Projet Medianova — revue juridique
    ('c0000001-0000-0000-0000-000000000017', '33333333-aaaa-bbbb-cccc-333333333333', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Le cabinet a renvoyé le contrat avec 3 modifications mineures. On signe cette semaine si tout va bien. @Mathis @Hugo préparez le plan de déploiement des 12 filiales.', ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '6 hours'),
    -- Projet Gruau — qualification
    ('c0000001-0000-0000-0000-000000000018', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'Premier call avec François très encourageant. Ils veulent digitaliser toute la gestion de flotte. @Mathis tu peux préparer une démo personnalisée fleet management ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '8 days'),
    ('c0000001-0000-0000-0000-000000000019', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Démo fleet prête. @Hugo peux-tu aussi préparer un business case ROI pour Gruau ? Ils sont très process-driven.', ARRAY['22222222-2222-2222-2222-222222222222'], 'message', NOW() - INTERVAL '5 days'),
    ('c0000001-0000-0000-0000-000000000020', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'Business case envoyé à Isabelle Renard. @Martial on a un bon timing, leur budget IT est voté en avril.', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '3 days'),
    -- Projet GreenTech — suivi startup
    ('c0000001-0000-0000-0000-000000000021', '22222222-aaaa-bbbb-cccc-222222222222', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'Antoine veut démarrer avec le module pipeline + ESG dès le mois prochain. @Mathis on active le setup technique la semaine prochaine ?', ARRAY['11111111-1111-1111-1111-111111111111'], 'message', NOW() - INTERVAL '2 days'),
    ('c0000001-0000-0000-0000-000000000022', '22222222-aaaa-bbbb-cccc-222222222222', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'Ok je bloque le créneau. @Martial tu valides la remise startup (-15%) avant que je confirme ?', ARRAY['33333333-3333-3333-3333-333333333333'], 'message', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 11. PROJECT DOCUMENTS
-- =====================================================
INSERT INTO project_documents (project_id, name, type, url, added_by) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', 'Architecture technique.pdf', 'pdf', '#', '11111111-1111-1111-1111-111111111111'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'Proposition Datapulse v1.doc', 'doc', '#', '11111111-1111-1111-1111-111111111111'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Contrat Medianova.pdf', 'pdf', '#', '33333333-3333-3333-3333-333333333333'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Planning déploiement.sheet', 'sheet', '#', '11111111-1111-1111-1111-111111111111'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Présentation COMEX.slide', 'slide', '#', '33333333-3333-3333-3333-333333333333'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'Proposition GreenTech.pdf', 'pdf', '#', '22222222-2222-2222-2222-222222222222'),
    ('55555555-aaaa-bbbb-cccc-555555555555', 'Rapport support annuel.pdf', 'pdf', '#', '22222222-2222-2222-2222-222222222222'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planning multi-campus.sheet', 'sheet', '#', '11111111-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Architecture technique OMNES.pdf', 'pdf', '#', '11111111-1111-1111-1111-111111111111'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Proposition OMNES v2.doc', 'doc', '#', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Proposition renouvellement Vetoptim.pdf', 'pdf', '#', '33333333-3333-3333-3333-333333333333'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Spec module prédictif.doc', 'doc', '#', '11111111-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Business case ROI Gruau.pdf', 'pdf', '#', '22222222-2222-2222-2222-222222222222'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Démo fleet management.slide', 'slide', '#', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. DEALS
-- =====================================================
INSERT INTO deals (id, company_id, project_id, title, value, probability, stage, expected_close_date, owner_id, notes) VALUES
    ('d0000001-0000-0000-0000-000000000001', '11111111-aaaa-bbbb-cccc-111111111111', '11111111-aaaa-bbbb-cccc-111111111111', 'CRM + Data Integration Datapulse', 38000, 55, 'proposal', '2026-03-30', '11111111-1111-1111-1111-111111111111', 'Proposition en cours. Le CTO veut une démo API.'),
    ('d0000001-0000-0000-0000-000000000002', '22222222-aaaa-bbbb-cccc-222222222222', '22222222-aaaa-bbbb-cccc-222222222222', 'CRM Startup GreenTech', 18000, 45, 'proposal', '2026-04-15', '22222222-2222-2222-2222-222222222222', 'Offre startup envoyée. En attente de retour.'),
    ('d0000001-0000-0000-0000-000000000003', '33333333-aaaa-bbbb-cccc-333333333333', '33333333-aaaa-bbbb-cccc-333333333333', 'Déploiement Groupe Medianova', 65000, 80, 'negotiation', '2026-03-01', '33333333-3333-3333-3333-333333333333', 'Budget validé COMEX. En revue juridique.'),
    ('d0000001-0000-0000-0000-000000000004', '55555555-aaaa-bbbb-cccc-555555555555', '55555555-aaaa-bbbb-cccc-555555555555', 'Renouvellement UrbanCraft', 12000, 100, 'closed_won', '2025-06-01', '22222222-2222-2222-2222-222222222222', 'Renouvelé automatiquement.'),
    ('d0000001-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CRM 5 campus OMNES Education', 45000, 60, 'proposal', '2026-03-15', '11111111-1111-1111-1111-111111111111', 'Déploiement multi-campus. DSI validé, en attente VP.'),
    ('d0000001-0000-0000-0000-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Renouvellement + Upsell Vetoptim', 32000, 90, 'negotiation', '2026-02-28', '33333333-3333-3333-3333-333333333333', 'Renouvellement licence + module prédictif. Claire très intéressée.'),
    ('d0000001-0000-0000-0000-000000000007', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Fleet Management Digital Gruau', 20000, 30, 'qualification', '2026-04-30', '33333333-3333-3333-3333-333333333333', 'Première qualification. François Dubois intéressé.'),
    ('d0000001-0000-0000-0000-000000000008', '44444444-aaaa-bbbb-cccc-444444444444', NULL, 'Plateforme logistique NordLogistic', 55000, 15, 'qualification', '2026-06-30', '11111111-1111-1111-1111-111111111111', 'Premier contact via Accenture. Potentiel gros deal.')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 13. TEAM ACTIVITY (recent, realistic)
-- =====================================================
INSERT INTO team_activity (id, user_id, user_name, user_avatar, action, target_type, target_id, target_name, description, mentioned_users, timestamp) VALUES
    ('e0000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'contacted', 'company', '33333333-aaaa-bbbb-cccc-333333333333', 'Medianova', 'Échange avec le juridique sur les conditions contractuelles', '{}', NOW() - INTERVAL '1 hour'),
    ('e0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'created', 'task', 'a0000001-0000-0000-0000-000000000003', 'Préparer démo technique Datapulse', 'Démo API demandée par le CTO', '{}', NOW() - INTERVAL '3 hours'),
    ('e0000001-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'contacted', 'company', '22222222-aaaa-bbbb-cccc-222222222222', 'GreenTech Solutions', 'Suivi proposition commerciale avec Antoine', '{}', NOW() - INTERVAL '5 hours'),
    ('e0000001-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'mentioned', 'project', '33333333-aaaa-bbbb-cccc-333333333333', 'Déploiement Groupe Medianova', '@Mathis @Hugo préparez le kick-off', ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'], NOW() - INTERVAL '6 hours'),
    ('e0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'contacted', 'company', '11111111-aaaa-bbbb-cccc-111111111111', 'Datapulse', 'Point technique avec Lucas Bernard (CTO)', '{}', NOW() - INTERVAL '1 day'),
    ('e0000001-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Hugo', '/hugo.jpg', 'completed', 'task', 'a0000001-0000-0000-0000-000000000009', 'Premier call Datapulse', 'Call de découverte effectué', '{}', NOW() - INTERVAL '2 days'),
    ('e0000001-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Martial', '/martial.jpg', 'signed', 'deal', 'd0000001-0000-0000-0000-000000000004', 'UrbanCraft', 'Renouvellement contrat annuel 12k€', '{}', NOW() - INTERVAL '2 days'),
    ('e0000001-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Mathis', '/mathis.jpg', 'created', 'project', '11111111-aaaa-bbbb-cccc-111111111111', 'Intégration CRM & Data Stack', 'Nouveau projet Datapulse créé', '{}', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 14. NOTIFICATIONS (unread, for briefing IA)
-- =====================================================
INSERT INTO notifications (id, user_id, type, title, message, link, read, created_at) VALUES
    ('f0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'mention', 'Martial vous a mentionné', 'Sur Datapulse: "@Mathis peux-tu finaliser la proposition ?"', '/tasks', FALSE, NOW() - INTERVAL '1 day'),
    ('f0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'mention', 'Martial vous a mentionné', 'Sur Medianova: "@Mathis checker le template contrat"', '/tasks', FALSE, NOW() - INTERVAL '6 hours'),
    ('f0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'mention', 'Hugo vous a mentionné', 'Sur OMNES: "Planning campus Lyon"', '/projects', FALSE, NOW() - INTERVAL '3 days'),
    ('f0000001-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'mention', 'Mathis vous a mentionné', 'Sur Datapulse: "@Hugo prépare les slides data"', '/tasks', FALSE, NOW() - INTERVAL '3 hours'),
    ('f0000001-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'mention', 'Martial vous a mentionné', 'Sur Medianova: "Préparez le kick-off"', '/projects', FALSE, NOW() - INTERVAL '6 hours'),
    ('f0000001-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'mention', 'Mathis vous a mentionné', 'Sur Medianova: "Clause de résiliation"', '/projects', FALSE, NOW() - INTERVAL '1 day'),
    ('f0000001-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'task_assigned', 'Nouvelle tâche assignée', 'Qualifier NordLogistic', '/tasks', FALSE, NOW()),
    ('f0000001-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'task_assigned', 'Nouvelle tâche assignée', 'Organiser onboarding UrbanCraft v2', '/tasks', FALSE, NOW() - INTERVAL '1 day'),
    ('f0000001-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'mention', 'Martial vous a mentionné', 'Sur Vetoptim: "Envoie la proposition à Claire"', '/projects', FALSE, NOW() - INTERVAL '1 day'),
    ('f0000001-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'mention', 'Martial vous a mentionné', 'Sur Vetoptim: "Prépare le plan d''accompagnement IA"', '/projects', FALSE, NOW() - INTERVAL '1 day'),
    ('f0000001-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'mention', 'Martial vous a mentionné', 'Sur Medianova: "Préparez le plan déploiement 12 filiales"', '/projects', FALSE, NOW() - INTERVAL '6 hours'),
    ('f0000001-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'mention', 'Martial vous a mentionné', 'Sur Medianova: "Préparez le plan déploiement 12 filiales"', '/projects', FALSE, NOW() - INTERVAL '6 hours'),
    ('f0000001-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'mention', 'Hugo vous a mentionné', 'Sur OMNES: "On devrait pitcher l''extension"', '/projects', FALSE, NOW() - INTERVAL '12 hours'),
    ('f0000001-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'mention', 'Martial vous a mentionné', 'Sur Gruau: "Prépare une démo fleet management"', '/projects', FALSE, NOW() - INTERVAL '8 days'),
    ('f0000001-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 'mention', 'Hugo vous a mentionné', 'Sur Gruau: "Budget IT voté en avril"', '/projects', FALSE, NOW() - INTERVAL '3 days'),
    ('f0000001-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', 'mention', 'Mathis vous a mentionné', 'Sur Datapulse: "Valide le pricing avant envoi"', '/projects', FALSE, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 15. COMPANY DOCUMENTS
-- =====================================================
INSERT INTO documents (company_id, name, type, url, added_by, created_at) VALUES
    ('11111111-aaaa-bbbb-cccc-111111111111', 'NDA Datapulse.pdf', 'pdf', '#', 'Mathis', NOW() - INTERVAL '20 days'),
    ('11111111-aaaa-bbbb-cccc-111111111111', 'Architecture technique API.pdf', 'pdf', '#', 'Mathis', NOW() - INTERVAL '8 days'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Proposition Medianova 65k.pdf', 'pdf', '#', 'Martial', NOW() - INTERVAL '12 days'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Présentation COMEX.slide', 'slide', '#', 'Martial', NOW() - INTERVAL '7 days'),
    ('33333333-aaaa-bbbb-cccc-333333333333', 'Contrat - version juridique.pdf', 'pdf', '#', 'Martial', NOW() - INTERVAL '2 days'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planning multi-campus OMNES.sheet', 'sheet', '#', 'Mathis', NOW() - INTERVAL '10 days'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cahier des charges OMNES.doc', 'doc', '#', 'Hugo', NOW() - INTERVAL '25 days'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Renouvellement Vetoptim 2026.pdf', 'pdf', '#', 'Martial', NOW() - INTERVAL '5 days'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Specs module prédictif.doc', 'doc', '#', 'Mathis', NOW() - INTERVAL '3 days'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Business case ROI Gruau.pdf', 'pdf', '#', 'Hugo', NOW() - INTERVAL '4 days'),
    ('22222222-aaaa-bbbb-cccc-222222222222', 'Proposition GreenTech 18k.pdf', 'pdf', '#', 'Hugo', NOW() - INTERVAL '6 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFY
-- =====================================================
SELECT '=== SEED COMPLETE ===' AS status;
SELECT 'Companies: ' || COUNT(*) FROM companies;
SELECT 'Contacts: ' || COUNT(*) FROM contacts;
SELECT 'Tasks: ' || COUNT(*) FROM tasks;
SELECT 'Task Comments: ' || COUNT(*) FROM task_comments;
SELECT 'Projects: ' || COUNT(*) FROM projects;
SELECT 'Project Notes: ' || COUNT(*) FROM project_notes;
SELECT 'Deals: ' || COUNT(*) FROM deals;
SELECT 'Team Activity: ' || COUNT(*) FROM team_activity;
SELECT 'Notifications: ' || COUNT(*) FROM notifications;
