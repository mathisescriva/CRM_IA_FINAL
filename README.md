<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lexia CRM - CRM Moderne avec IA

CRM intelligent avec intégration Gmail, Google Calendar et automatisations IA.

## 🚀 Démarrage rapide

**Prérequis:** Node.js

```bash
# 1. Installation
npm install

# 2. Configuration Google (requis pour Gmail/Calendar)
cp .env.example .env
# Éditez .env avec vos clés Google API
# Guide détaillé : GOOGLE_SETUP.md

# 3. Lancement
npm run dev
```

## 🔧 Configuration

### Google Calendar & Gmail (Recommandé)

Pour utiliser les fonctionnalités de calendrier et d'emails :

1. **Guide complet** : Consultez [`GOOGLE_SETUP.md`](./GOOGLE_SETUP.md)
2. **Créez vos clés** : [Google Cloud Console](https://console.cloud.google.com/)
3. **Configuration** : Ajoutez-les dans `.env`

⚠️ Sans ces clés, l'application fonctionnera en mode démonstration (données mock).

### Gemini API (Optionnel)

Pour les fonctionnalités IA avancées, ajoutez votre clé Gemini dans `.env.local`.

## ✨ Fonctionnalités

- 📊 **Dashboard intelligent** - Vue d'ensemble avec insights
- 🏢 **Gestion des entreprises** - Contacts, pipeline, historique
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

## 📚 Documentation

- [Configuration Google API](./GOOGLE_SETUP.md) - Guide complet
- [AI Studio App](https://ai.studio/apps/drive/1-ZYvciVtA0wjyNAmyx9RRqrxKtmodPyD)

## 🛠️ Stack technique

- **Frontend** : React 19 + TypeScript + Vite
- **Styling** : Tailwind CSS
- **APIs** : Google APIs (Gmail, Calendar)
- **Storage** : LocalStorage (Mock) / Supabase (Production)
- **IA** : Gemini API

## 📄 Licence

Projet développé avec AI Studio.

