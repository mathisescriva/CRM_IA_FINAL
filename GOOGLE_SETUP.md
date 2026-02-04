# Configuration Google Calendar & Gmail

## 🔑 Obtenir vos clés API Google

### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez-en un existant
3. Notez le nom de votre projet

### 2. Activer les APIs

1. Allez dans **APIs & Services** > **Enabled APIs & services**
2. Cliquez sur **+ ENABLE APIS AND SERVICES**
3. Recherchez et activez :
   - **Gmail API**
   - **Google Calendar API**

### 3. Créer une clé API

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **+ CREATE CREDENTIALS** > **API key**
3. Copiez la clé générée
4. (Optionnel) Cliquez sur **Restrict key** pour sécuriser :
   - Choisissez "HTTP referrers"
   - Ajoutez : `http://localhost:*` et votre domaine de production

### 4. Créer un OAuth 2.0 Client ID

1. Dans **Credentials**, cliquez sur **+ CREATE CREDENTIALS** > **OAuth client ID**
2. Si c'est la première fois, configurez l'écran de consentement OAuth :
   - Type : **External**
   - Nom de l'application : `Lexia CRM`
   - Email d'assistance : votre email
   - Scopes : Ajoutez Gmail et Calendar
   - Ajoutez vos utilisateurs test si en mode développement
3. Choisissez **Web application**
4. Configurez :
   - **Authorized JavaScript origins** :
     - `http://localhost:3000`
     - Votre domaine de production si applicable
   - **Authorized redirect URIs** :
     - `http://localhost:3000`
5. Copiez le **Client ID** généré

### 5. Configurer votre application

1. Créez un fichier `.env` à la racine du projet :
   ```bash
   cp .env.example .env
   ```

2. Modifiez le fichier `.env` avec vos clés :
   ```env
   VITE_GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=votre-api-key
   ```

3. Redémarrez le serveur de développement :
   ```bash
   npm run dev
   ```

## ✅ Test

1. Allez sur `/calendar` dans votre app
2. Cliquez sur "Connecter Google Calendar"
3. Une popup Google devrait s'ouvrir pour demander l'autorisation
4. Après autorisation, votre calendrier devrait s'afficher

## 🔒 Sécurité

- **Ne commitez JAMAIS** vos clés dans Git (déjà configuré dans `.gitignore`)
- En production, utilisez des variables d'environnement sécurisées
- Restreignez vos clés API aux domaines autorisés
- Utilisez l'écran de consentement OAuth pour contrôler l'accès

## 🚨 Problèmes courants

### "ID Client non configuré"
- Vérifiez que le fichier `.env` existe et contient les bonnes clés
- Redémarrez le serveur après avoir créé/modifié le `.env`

### "Popup bloquée"
- Autorisez les popups pour localhost dans votre navigateur

### "Access denied"
- Vérifiez que les APIs Gmail et Calendar sont activées
- Vérifiez que les scopes sont corrects dans l'écran de consentement

## 📚 Documentation

- [Google Cloud Console](https://console.cloud.google.com/)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Calendar API Documentation](https://developers.google.com/calendar)
