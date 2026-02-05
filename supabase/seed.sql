-- =====================================================
-- LEXIA CRM - Seed Data
-- =====================================================
-- Run this AFTER schema.sql to populate initial data

-- =====================================================
-- USERS (Lexia Team)
-- =====================================================

INSERT INTO users (id, email, name, avatar_url, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'mathis@lexia.fr', 'Mathis', '/mathis.jpg', 'Account Executive'),
    ('22222222-2222-2222-2222-222222222222', 'hugo@lexia.fr', 'Hugo', '/hugo.jpg', 'Customer Success'),
    ('33333333-3333-3333-3333-333333333333', 'martial@lexia.fr', 'Martial', '/martial.jpg', 'Sales Director');

-- =====================================================
-- COMPANIES - CLIENTS
-- =====================================================

INSERT INTO companies (id, name, type, entity_type, importance, pipeline_stage, website, logo_url, last_contact_date, general_comment, created_at) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OMNES Education', 'GE/ETI', 'client', 'high', 'proposal', 'omneseducation.com', 'https://logo.clearbit.com/omneseducation.com', '2026-01-25 16:30:00+00', 'Compte stratégique - Groupe d''enseignement supérieur avec 15 000 étudiants sur 5 campus. Potentiel de déploiement important.', '2026-01-10 00:00:00+00'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vetoptim', 'PME', 'client', 'high', 'validation', 'vetoptim.fr', 'https://ui-avatars.com/api/?name=Vetoptim&background=10b981&color=fff&size=128&bold=true', '2026-01-12 09:00:00+00', 'Startup innovante dans le secteur vétérinaire. Très réactive, décision rapide attendue. Budget confirmé.', '2025-12-15 00:00:00+00'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gruau', 'GE/ETI', 'client', 'medium', 'exchange', 'gruau.com', 'https://logo.clearbit.com/gruau.com', '2026-01-30 14:00:00+00', 'Carrossier industriel leader en France. Intéressé par la digitalisation de leur gestion client. Premier RDV à planifier.', '2026-01-28 00:00:00+00');

-- =====================================================
-- COMPANIES - PARTNERS
-- =====================================================

INSERT INTO companies (id, name, type, entity_type, importance, pipeline_stage, website, logo_url, last_contact_date, general_comment, partner_type, partner_since, commission_rate, referrals_count, created_at) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Accenture', 'GE/ETI', 'partner', 'high', 'client_success', 'accenture.com', 'https://logo.clearbit.com/accenture.com', '2026-01-28 10:00:00+00', 'Partenaire stratégique consulting. 3 deals apportés depuis le début du partenariat. Excellent relationnel.', 'consulting', '2025-06-01', 15.00, 3, '2025-06-01 00:00:00+00'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Stripe', 'GE/ETI', 'partner', 'medium', 'client_success', 'stripe.com', 'https://logo.clearbit.com/stripe.com', '2026-01-20 09:00:00+00', 'Partenaire technologique - Intégration paiement. Co-marketing prévu Q2 2026.', 'technology', '2025-09-15', 10.00, 1, '2025-09-15 00:00:00+00'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Cabinet Dupont & Associés', 'PME', 'partner', 'low', 'client_success', NULL, NULL, '2026-01-05 11:00:00+00', 'Cabinet juridique partenaire pour nos contrats et questions légales.', 'legal', '2025-03-01', NULL, 0, '2025-03-01 00:00:00+00');

-- =====================================================
-- CONTACTS
-- =====================================================

-- OMNES Education contacts
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sophie Martin', 'Directrice des Admissions', '+33 1 45 67 89 00', TRUE, 'female'),
    ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pierre Durand', 'DSI', '+33 1 45 67 89 01', FALSE, 'male');

-- Vetoptim contacts
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dr. Claire Vétérinaire', 'CEO & Fondatrice', '+33 6 12 34 56 78', TRUE, 'female'),
    ('c3333334-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tristan Dubois', 'Directeur Technique', '+33 6 98 76 54 32', FALSE, 'male');

-- Gruau contacts
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('c4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Jean-Marc Leroy', 'Responsable Achats', '+33 2 41 XX XX XX', TRUE, 'male'),
    ('c5555555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Anne-Sophie Petit', 'Directrice Commerciale', NULL, FALSE, 'female');

-- Accenture contacts
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('c6666666-6666-6666-6666-666666666666', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Thomas Lefebvre', 'Senior Manager - CRM Practice', '+33 1 53 23 XX XX', TRUE, 'male');

-- Stripe contacts
INSERT INTO contacts (id, company_id, name, role, is_main_contact, gender) VALUES
    ('c7777777-7777-7777-7777-777777777777', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Julie Chen', 'Partnership Manager France', TRUE, 'female');

-- Cabinet Dupont contacts
INSERT INTO contacts (id, company_id, name, role, phone, is_main_contact, gender) VALUES
    ('c8888888-8888-8888-8888-888888888888', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Me. François Dupont', 'Avocat Associé', '+33 1 42 XX XX XX', TRUE, 'male');

-- =====================================================
-- CONTACT EMAILS
-- =====================================================

INSERT INTO contact_emails (contact_id, email, is_primary) VALUES
    ('c1111111-1111-1111-1111-111111111111', 's.martin@omneseducation.com', TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'p.durand@omneseducation.com', TRUE),
    ('c3333333-3333-3333-3333-333333333333', 'claire@vetoptim.fr', TRUE),
    ('c3333333-3333-3333-3333-333333333333', 'contact@vetoptim.fr', FALSE),
    ('c3333334-3333-3333-3333-333333333333', 'tristan.dubois@vetoptim.fr', TRUE),
    ('c3333334-3333-3333-3333-333333333333', 't.dubois@vetoptim.fr', FALSE),
    ('c4444444-4444-4444-4444-444444444444', 'jm.leroy@gruau.com', TRUE),
    ('c5555555-5555-5555-5555-555555555555', 'as.petit@gruau.com', TRUE),
    ('c6666666-6666-6666-6666-666666666666', 'thomas.lefebvre@accenture.com', TRUE),
    ('c7777777-7777-7777-7777-777777777777', 'julie.chen@stripe.com', TRUE),
    ('c8888888-8888-8888-8888-888888888888', 'f.dupont@dupont-avocats.fr', TRUE);

-- =====================================================
-- COMPANY TEAM MEMBERS
-- =====================================================

-- OMNES Education team
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Customer Success');

-- Vetoptim team
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Sales Director');

-- Gruau team
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Account Executive'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Customer Success');

-- Accenture team
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'Partner Manager');

-- Stripe team
INSERT INTO company_team_members (company_id, user_id, role) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Integration Lead');

-- =====================================================
-- CHECKLIST ITEMS
-- =====================================================

-- OMNES Education checklist
INSERT INTO checklist_items (company_id, stage_id, label, completed, notes) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'entry_point', 'Premier Contact', TRUE, 'Contact établi via LinkedIn.'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'exchange', 'En Discussion', TRUE, 'Besoin identifié : CRM admissions multi-campus.'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'proposal', 'Proposition', TRUE, 'Proposition envoyée le 20/01. En attente retour.'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'validation', 'Validation', FALSE, ''),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'client_success', 'Client Actif', FALSE, '');

-- Vetoptim checklist
INSERT INTO checklist_items (company_id, stage_id, label, completed, notes) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'entry_point', 'Premier Contact', TRUE, 'Rencontrée au salon VetExpo.'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'exchange', 'En Discussion', TRUE, 'Solution IA pour optimisation cliniques.'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'proposal', 'Proposition', TRUE, 'Offre de 24k€/an acceptée sur le principe.'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'validation', 'Validation', TRUE, 'En attente signature contrat.'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'client_success', 'Client Actif', FALSE, '');

-- Gruau checklist
INSERT INTO checklist_items (company_id, stage_id, label, completed, notes) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'entry_point', 'Premier Contact', TRUE, 'Demande entrante via site web.'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'exchange', 'En Discussion', TRUE, 'Besoin : gestion de flotte et suivi production.'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'proposal', 'Proposition', FALSE, ''),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'validation', 'Validation', FALSE, ''),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'client_success', 'Client Actif', FALSE, '');

-- =====================================================
-- ACTIVITIES
-- =====================================================

-- OMNES Education activities
INSERT INTO activities (company_id, type, title, description, date, user_name, direction, sync_status) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'meeting', 'Réunion de découverte', 'Présentation des besoins en CRM pour les admissions. 15 000 étudiants à gérer.', '2026-01-15 14:00:00+00', 'Mathis', NULL, 'synced'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'Envoi de la proposition commerciale', 'Proposition pour le déploiement sur 5 campus.', '2026-01-20 10:00:00+00', 'Mathis', 'outbound', 'synced'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'call', 'Appel de suivi', 'Questions sur l''intégration avec leur SI existant.', '2026-01-25 16:30:00+00', 'Hugo', 'inbound', 'synced');

-- Vetoptim activities
INSERT INTO activities (company_id, type, title, description, date, user_name, sync_status) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'meeting', 'Démo produit', 'Démonstration des fonctionnalités IA pour l''optimisation vétérinaire.', '2026-01-10 11:00:00+00', 'Martial', 'synced'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note', 'Compte-rendu interne', 'Prospect très intéressé, budget validé en interne. Décision attendue fin janvier.', '2026-01-12 09:00:00+00', 'Martial', 'none');

-- Gruau activities
INSERT INTO activities (company_id, type, title, description, date, user_name, direction, sync_status) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'email', 'Demande d''information', 'Contact entrant via le site web. Intéressé par la solution de gestion de flotte.', '2026-01-28 08:45:00+00', 'Hugo', 'inbound', 'synced'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'call', 'Premier appel découverte', 'Prise de contact avec le responsable achats. RDV prévu la semaine prochaine.', '2026-01-30 14:00:00+00', 'Mathis', 'outbound', 'synced');

-- Accenture activities
INSERT INTO activities (company_id, type, title, description, date, user_name, sync_status) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'meeting', 'Quarterly Partner Review', 'Revue trimestrielle du partenariat', '2026-01-15 14:00:00+00', 'Martial', 'synced');

-- Stripe activities
INSERT INTO activities (company_id, type, title, description, date, user_name, direction, sync_status) VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'email', 'Nouvelle intégration disponible', 'Stripe Billing v3 disponible', '2026-01-20 09:00:00+00', 'Hugo', 'inbound', 'synced');

-- =====================================================
-- DOCUMENTS
-- =====================================================

INSERT INTO documents (company_id, name, type, url, added_by, created_at) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Proposition_OMNES_v2.pdf', 'pdf', '#', 'Mathis', '2026-01-20 10:00:00+00'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cahier_des_charges.pdf', 'pdf', '#', 'Sophie Martin', '2026-01-16 14:00:00+00'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Contrat_Vetoptim_2026.pdf', 'pdf', '#', 'Martial', '2026-01-12 09:00:00+00'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Partnership_Agreement_2025.pdf', 'pdf', '#', 'Martial', '2025-06-01 00:00:00+00');

-- =====================================================
-- SAMPLE TASKS
-- =====================================================

INSERT INTO tasks (id, title, description, company_id, company_name, status, priority, due_date) VALUES
    ('t1111111-1111-1111-1111-111111111111', 'Relancer OMNES Education', 'Envoyer un email de suivi pour la proposition commerciale', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OMNES Education', 'todo', 'high', '2026-02-07'),
    ('t2222222-2222-2222-2222-222222222222', 'Préparer contrat Vetoptim', 'Finaliser le contrat avant signature', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vetoptim', 'in_progress', 'urgent', '2026-02-05'),
    ('t3333333-3333-3333-3333-333333333333', 'Planifier démo Gruau', 'Organiser une démo produit avec l''équipe technique', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Gruau', 'todo', 'medium', '2026-02-10');

INSERT INTO task_assignees (task_id, user_id) VALUES
    ('t1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
    ('t1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
    ('t2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
    ('t3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');
