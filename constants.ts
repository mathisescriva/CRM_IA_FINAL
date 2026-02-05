import { Company, PipelineColumn, Activity } from './types';

export const PIPELINE_COLUMNS: PipelineColumn[] = [
    { id: 'entry_point', title: 'Premier Contact' },
    { id: 'exchange', title: 'En Discussion' },
    { id: 'proposal', title: 'Proposition' },
    { id: 'validation', title: 'Validation' },
    { id: 'client_success', title: 'Client Actif' },
];

const DEFAULT_CHECKLIST = [
    { id: 'entry_point', label: 'Premier Contact', completed: true, notes: '' },
    { id: 'exchange', label: 'En Discussion', completed: false, notes: '' },
    { id: 'proposal', label: 'Proposition', completed: false, notes: '' },
    { id: 'validation', label: 'Validation', completed: false, notes: '' },
    { id: 'client_success', label: 'Client Actif', completed: false, notes: '' },
];

// Activités pour OMNES Education
const OMNES_ACTIVITIES: Activity[] = [
    { 
        id: 'omnes-1', 
        type: 'meeting', 
        title: 'Réunion de découverte', 
        description: 'Présentation des besoins en CRM pour les admissions. 15 000 étudiants à gérer.', 
        date: '2026-01-15T14:00:00Z', 
        user: 'Mathis', 
        syncStatus: 'synced' 
    },
    { 
        id: 'omnes-2', 
        type: 'email', 
        direction: 'outbound', 
        title: 'Envoi de la proposition commerciale', 
        description: 'Proposition pour le déploiement sur 5 campus.', 
        date: '2026-01-20T10:00:00Z', 
        user: 'Mathis', 
        syncStatus: 'synced' 
    },
    { 
        id: 'omnes-3', 
        type: 'call', 
        direction: 'inbound', 
        title: 'Appel de suivi', 
        description: 'Questions sur l\'intégration avec leur SI existant.', 
        date: '2026-01-25T16:30:00Z', 
        user: 'Hugo', 
        syncStatus: 'synced' 
    },
];

// Activités pour Vetoptim
const VETOPTIM_ACTIVITIES: Activity[] = [
    { 
        id: 'vet-1', 
        type: 'meeting', 
        title: 'Démo produit', 
        description: 'Démonstration des fonctionnalités IA pour l\'optimisation vétérinaire.', 
        date: '2026-01-10T11:00:00Z', 
        user: 'Martial', 
        syncStatus: 'synced' 
    },
    { 
        id: 'vet-2', 
        type: 'note', 
        title: 'Compte-rendu interne', 
        description: 'Prospect très intéressé, budget validé en interne. Décision attendue fin janvier.', 
        date: '2026-01-12T09:00:00Z', 
        user: 'Martial', 
        syncStatus: 'none' 
    },
];

// Activités pour Gruau
const GRUAU_ACTIVITIES: Activity[] = [
    { 
        id: 'gruau-1', 
        type: 'email', 
        direction: 'inbound', 
        title: 'Demande d\'information', 
        description: 'Contact entrant via le site web. Intéressé par la solution de gestion de flotte.', 
        date: '2026-01-28T08:45:00Z', 
        user: 'Hugo', 
        syncStatus: 'synced' 
    },
    { 
        id: 'gruau-2', 
        type: 'call', 
        direction: 'outbound', 
        title: 'Premier appel découverte', 
        description: 'Prise de contact avec le responsable achats. RDV prévu la semaine prochaine.', 
        date: '2026-01-30T14:00:00Z', 
        user: 'Mathis', 
        syncStatus: 'synced' 
    },
];

export const MOCK_COMPANIES: Company[] = [
    {
        id: 'omnes-education',
        name: 'OMNES Education',
        type: 'GE/ETI',
        entityType: 'client',
        importance: 'high',
        pipelineStage: 'proposal',
        lastContactDate: '2026-01-25T16:30:00Z',
        website: 'omneseducation.com',
        logoUrl: 'https://logo.clearbit.com/omneseducation.com',
        team: [
            { id: 'tm-1', name: 'Mathis', role: 'Account Executive', avatarUrl: '/mathis.jpg', email: 'mathis@lexia.fr' },
            { id: 'tm-2', name: 'Hugo', role: 'Customer Success', avatarUrl: '/hugo.jpg', email: 'hugo@lexia.fr' }
        ],
        contacts: [
            { 
                id: 'contact-omnes-1', 
                name: 'Sophie Martin', 
                emails: ['s.martin@omneseducation.com'], 
                role: 'Directrice des Admissions', 
                phone: '+33 1 45 67 89 00',
                isMainContact: true,
                gender: 'female'
            },
            { 
                id: 'contact-omnes-2', 
                name: 'Pierre Durand', 
                emails: ['p.durand@omneseducation.com'], 
                role: 'DSI', 
                phone: '+33 1 45 67 89 01',
                isMainContact: false,
                gender: 'male'
            }
        ],
        checklist: [
            { id: 'entry_point', label: 'Premier Contact', completed: true, notes: 'Contact établi via LinkedIn.' },
            { id: 'exchange', label: 'En Discussion', completed: true, notes: 'Besoin identifié : CRM admissions multi-campus.' },
            { id: 'proposal', label: 'Proposition', completed: true, notes: 'Proposition envoyée le 20/01. En attente retour.' },
            { id: 'validation', label: 'Validation', completed: false, notes: '' },
            { id: 'client_success', label: 'Client Actif', completed: false, notes: '' },
        ],
        activities: OMNES_ACTIVITIES,
        documents: [
            { id: 'doc-omnes-1', name: 'Proposition_OMNES_v2.pdf', type: 'pdf', url: '#', addedBy: 'Mathis', createdAt: '2026-01-20T10:00:00Z' },
            { id: 'doc-omnes-2', name: 'Cahier_des_charges.pdf', type: 'pdf', url: '#', addedBy: 'Sophie Martin', createdAt: '2026-01-16T14:00:00Z' }
        ],
        createdAt: '2026-01-10T00:00:00Z',
        generalComment: 'Compte stratégique - Groupe d\'enseignement supérieur avec 15 000 étudiants sur 5 campus. Potentiel de déploiement important.'
    },
    {
        id: 'vetoptim',
        name: 'Vetoptim',
        type: 'PME',
        entityType: 'client',
        importance: 'high',
        pipelineStage: 'validation',
        lastContactDate: '2026-01-12T09:00:00Z',
        website: 'vetoptim.fr',
        logoUrl: 'https://ui-avatars.com/api/?name=Vetoptim&background=10b981&color=fff&size=128&bold=true',
        team: [
            { id: 'tm-3', name: 'Martial', role: 'Sales Director', avatarUrl: '/martial.jpg', email: 'martial@lexia.fr' }
        ],
        contacts: [
            { 
                id: 'contact-vet-1', 
                name: 'Dr. Claire Vétérinaire', 
                emails: ['claire@vetoptim.fr', 'contact@vetoptim.fr'], 
                role: 'CEO & Fondatrice', 
                phone: '+33 6 12 34 56 78',
                isMainContact: true,
                gender: 'female'
            },
            { 
                id: 'contact-vet-2', 
                name: 'Tristan Dubois', 
                emails: ['tristan.dubois@vetoptim.fr', 't.dubois@vetoptim.fr'], 
                role: 'Directeur Technique', 
                phone: '+33 6 98 76 54 32',
                isMainContact: false,
                gender: 'male'
            }
        ],
        checklist: [
            { id: 'entry_point', label: 'Premier Contact', completed: true, notes: 'Rencontrée au salon VetExpo.' },
            { id: 'exchange', label: 'En Discussion', completed: true, notes: 'Solution IA pour optimisation cliniques.' },
            { id: 'proposal', label: 'Proposition', completed: true, notes: 'Offre de 24k€/an acceptée sur le principe.' },
            { id: 'validation', label: 'Validation', completed: true, notes: 'En attente signature contrat.' },
            { id: 'client_success', label: 'Client Actif', completed: false, notes: '' },
        ],
        activities: VETOPTIM_ACTIVITIES,
        documents: [
            { id: 'doc-vet-1', name: 'Contrat_Vetoptim_2026.pdf', type: 'pdf', url: '#', addedBy: 'Martial', createdAt: '2026-01-12T09:00:00Z' }
        ],
        createdAt: '2025-12-15T00:00:00Z',
        generalComment: 'Startup innovante dans le secteur vétérinaire. Très réactive, décision rapide attendue. Budget confirmé.'
    },
    {
        id: 'gruau',
        name: 'Gruau',
        type: 'GE/ETI',
        entityType: 'client',
        importance: 'medium',
        pipelineStage: 'exchange',
        lastContactDate: '2026-01-30T14:00:00Z',
        website: 'gruau.com',
        logoUrl: 'https://logo.clearbit.com/gruau.com',
        team: [
            { id: 'tm-4', name: 'Mathis', role: 'Account Executive', avatarUrl: '/mathis.jpg', email: 'mathis@lexia.fr' },
            { id: 'tm-5', name: 'Hugo', role: 'Customer Success', avatarUrl: '/hugo.jpg', email: 'hugo@lexia.fr' }
        ],
        contacts: [
            { 
                id: 'contact-gruau-1', 
                name: 'Jean-Marc Leroy', 
                emails: ['jm.leroy@gruau.com'], 
                role: 'Responsable Achats', 
                phone: '+33 2 41 XX XX XX',
                isMainContact: true,
                gender: 'male'
            },
            { 
                id: 'contact-gruau-2', 
                name: 'Anne-Sophie Petit', 
                emails: ['as.petit@gruau.com'], 
                role: 'Directrice Commerciale', 
                isMainContact: false,
                gender: 'female'
            }
        ],
        checklist: [
            { id: 'entry_point', label: 'Premier Contact', completed: true, notes: 'Demande entrante via site web.' },
            { id: 'exchange', label: 'En Discussion', completed: true, notes: 'Besoin : gestion de flotte et suivi production.' },
            { id: 'proposal', label: 'Proposition', completed: false, notes: '' },
            { id: 'validation', label: 'Validation', completed: false, notes: '' },
            { id: 'client_success', label: 'Client Actif', completed: false, notes: '' },
        ],
        activities: GRUAU_ACTIVITIES,
        documents: [],
        createdAt: '2026-01-28T00:00:00Z',
        generalComment: 'Carrossier industriel leader en France. Intéressé par la digitalisation de leur gestion client. Premier RDV à planifier.'
    },
    // PARTNERS
    {
        id: 'partner-accenture',
        name: 'Accenture',
        type: 'GE/ETI',
        entityType: 'partner',
        partnerType: 'consulting',
        partnerSince: '2025-06-01',
        commissionRate: 15,
        referralsCount: 3,
        importance: 'high',
        pipelineStage: 'client_success',
        lastContactDate: '2026-01-28T10:00:00Z',
        website: 'accenture.com',
        logoUrl: 'https://logo.clearbit.com/accenture.com',
        team: [
            { id: 'tm-acc-1', name: 'Martial', role: 'Partner Manager', avatarUrl: '/martial.jpg', email: 'martial@lexia.fr' }
        ],
        contacts: [
            { 
                id: 'contact-acc-1', 
                name: 'Thomas Lefebvre', 
                emails: ['thomas.lefebvre@accenture.com'], 
                role: 'Senior Manager - CRM Practice', 
                phone: '+33 1 53 23 XX XX',
                isMainContact: true,
                gender: 'male'
            }
        ],
        checklist: [],
        activities: [
            { id: 'acc-1', type: 'meeting', title: 'Quarterly Partner Review', description: 'Revue trimestrielle du partenariat', date: '2026-01-15T14:00:00Z', user: 'Martial', syncStatus: 'synced' }
        ],
        documents: [
            { id: 'doc-acc-1', name: 'Partnership_Agreement_2025.pdf', type: 'pdf', url: '#', addedBy: 'Martial', createdAt: '2025-06-01T00:00:00Z' }
        ],
        createdAt: '2025-06-01T00:00:00Z',
        generalComment: 'Partenaire stratégique consulting. 3 deals apportés depuis le début du partenariat. Excellent relationnel.'
    },
    {
        id: 'partner-stripe',
        name: 'Stripe',
        type: 'GE/ETI',
        entityType: 'partner',
        partnerType: 'technology',
        partnerSince: '2025-09-15',
        commissionRate: 10,
        referralsCount: 1,
        importance: 'medium',
        pipelineStage: 'client_success',
        lastContactDate: '2026-01-20T09:00:00Z',
        website: 'stripe.com',
        logoUrl: 'https://logo.clearbit.com/stripe.com',
        team: [
            { id: 'tm-str-1', name: 'Hugo', role: 'Integration Lead', avatarUrl: '/hugo.jpg', email: 'hugo@lexia.fr' }
        ],
        contacts: [
            { 
                id: 'contact-str-1', 
                name: 'Julie Chen', 
                emails: ['julie.chen@stripe.com'], 
                role: 'Partnership Manager France', 
                isMainContact: true,
                gender: 'female'
            }
        ],
        checklist: [],
        activities: [
            { id: 'str-1', type: 'email', direction: 'inbound', title: 'Nouvelle intégration disponible', description: 'Stripe Billing v3 disponible', date: '2026-01-20T09:00:00Z', user: 'Hugo', syncStatus: 'synced' }
        ],
        documents: [],
        createdAt: '2025-09-15T00:00:00Z',
        generalComment: 'Partenaire technologique - Intégration paiement. Co-marketing prévu Q2 2026.'
    },
    {
        id: 'partner-avocat',
        name: 'Cabinet Dupont & Associés',
        type: 'PME',
        entityType: 'partner',
        partnerType: 'legal',
        partnerSince: '2025-03-01',
        importance: 'low',
        pipelineStage: 'client_success',
        lastContactDate: '2026-01-05T11:00:00Z',
        team: [],
        contacts: [
            { 
                id: 'contact-avo-1', 
                name: 'Me. François Dupont', 
                emails: ['f.dupont@dupont-avocats.fr'], 
                role: 'Avocat Associé', 
                phone: '+33 1 42 XX XX XX',
                isMainContact: true,
                gender: 'male'
            }
        ],
        checklist: [],
        activities: [],
        documents: [],
        createdAt: '2025-03-01T00:00:00Z',
        generalComment: 'Cabinet juridique partenaire pour nos contrats et questions légales.'
    }
];
