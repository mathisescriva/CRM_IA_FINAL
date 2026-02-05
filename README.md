<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lexia CRM - CRM Moderne avec IA

CRM intelligent avec intégration Gmail, Google Calendar, base de données PostgreSQL et automatisations IA.

## 🚀 Démarrage rapide

**Prérequis:** Node.js

```bash
# 1. Installation
npm install

# 2. Configuration
cp .env.example .env
# Éditez .env avec vos clés (voir Configuration ci-dessous)

# 3. Lancement
npm run dev
```

## 🔧 Configuration

### Base de données Supabase (Recommandé)

Pour une vraie base de données PostgreSQL :

1. **Créez un projet** sur [Supabase](https://supabase.com)
2. **Exécutez le schéma** : Copiez le contenu de `supabase/schema.sql` dans l'éditeur SQL de Supabase
3. **Ajoutez les données initiales** : Exécutez `supabase/seed.sql` 
4. **Configurez les variables** dans `.env` :
   ```env
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre-anon-key
   ```

⚠️ Sans Supabase, l'application fonctionne en mode localStorage (données locales au navigateur).

### Structure de la base de données

```
├── users              # Équipe Lexia (utilisateurs)
├── companies          # Entreprises (clients & partenaires)
├── contacts           # Contacts des entreprises
├── contact_emails     # Emails des contacts (plusieurs par contact)
├── company_team_members # Équipe assignée à chaque entreprise
├── activities         # Historique des interactions
├── checklist_items    # Progression du pipeline
├── documents          # Documents joints
├── tasks              # Tâches
└── task_assignees     # Assignation des tâches
```

### Google Calendar & Gmail

Pour utiliser les fonctionnalités de calendrier et d'emails :

1. **Guide complet** : Consultez [`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md)
2. **Créez vos clés** : [Google Cloud Console](https://console.cloud.google.com/)
3. **Configuration** : Ajoutez `VITE_GOOGLE_CLIENT_ID` dans `.env`

### Gemini API (Optionnel)

Pour les fonctionnalités IA avancées, ajoutez votre clé Gemini dans `.env`.

## ✨ Fonctionnalités

- 📊 **Dashboard intelligent** - Vue d'ensemble avec insights
- 🏢 **Gestion des entreprises** - Clients et partenaires, contacts, pipeline
- 📋 **Pipeline Kanban** - Suivi visuel des opportunités
- 📧 **Intégration Gmail** - Emails directement dans le CRM
- 📅 **Google Calendar** - Planification et synchronisation
  - Compatible avec Notion Calendar
  - Création de RDV depuis une fiche client
  - Vue agenda complète
- ✅ **Tâches collaboratives** - Assignation multiple, échéances
- 👥 **Annuaire d'équipe** - Gestion des utilisateurs
- 🔍 **Recherche globale** - Cmd+K pour tout trouver
- 🎨 **Upload de logos** - Images pour les entreprises
- 📜 **Historique des échanges** - Emails par entreprise

## 📂 Structure du projet

```
├── supabase/
│   ├── schema.sql     # Schéma PostgreSQL complet
│   └── seed.sql       # Données initiales
├── services/
│   ├── supabase.ts    # Service de données (Supabase/Mock)
│   ├── auth.ts        # Authentification
│   ├── gmail.ts       # Intégration Gmail
│   └── calendar.ts    # Intégration Google Calendar
├── pages/             # Pages de l'application
├── components/        # Composants React
└── types.ts           # Types TypeScript
```

## 📚 Documentation

- [Configuration Google API](./GOOGLE_SETUP.md) - Guide complet
- [Schéma de base de données](./supabase/schema.sql) - Structure PostgreSQL

## 🛠️ Stack technique

- **Frontend** : React 19 + TypeScript + Vite
- **Styling** : Tailwind CSS + shadcn/ui
- **Database** : PostgreSQL (Supabase)
- **APIs** : Google APIs (Gmail, Calendar)
- **IA** : Gemini API

## 📄 Licence

Projet développé avec AI Studio.

