#!/bin/bash

echo "🔍 Vérification de la configuration Lexia CRM"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Fichier .env non trouvé"
    echo "   Créez-le avec : cp .env.example .env"
    echo ""
    exit 1
fi

# Check for Google Client ID
if grep -q "VITE_GOOGLE_CLIENT_ID=your-client-id" .env || ! grep -q "VITE_GOOGLE_CLIENT_ID=" .env; then
    echo "⚠️  VITE_GOOGLE_CLIENT_ID non configuré"
    echo "   Les fonctionnalités Gmail et Calendar ne fonctionneront pas"
else
    echo "✅ VITE_GOOGLE_CLIENT_ID configuré"
fi

# Check for Google API Key
if grep -q "VITE_GOOGLE_API_KEY=your-api-key" .env || ! grep -q "VITE_GOOGLE_API_KEY=" .env; then
    echo "⚠️  VITE_GOOGLE_API_KEY non configuré"
    echo "   Les fonctionnalités Gmail et Calendar ne fonctionneront pas"
else
    echo "✅ VITE_GOOGLE_API_KEY configuré"
fi

echo ""
echo "📚 Guide de configuration : GOOGLE_SETUP.md"
echo "🌐 Google Cloud Console : https://console.cloud.google.com/"
echo ""
