#!/bin/bash
# Start PostgreSQL and PostgREST for Lexia CRM

echo "🚀 Starting Lexia CRM Database..."

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Start PostgreSQL if not running
if ! pg_isready -q; then
    echo "📦 Starting PostgreSQL..."
    brew services start postgresql@16
    sleep 3
fi

# Check if database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw lexia_crm; then
    echo "🗄️  Creating database..."
    createdb lexia_crm
    echo "📋 Applying schema..."
    psql -d lexia_crm -f supabase/schema.sql
    echo "🌱 Seeding data..."
    psql -d lexia_crm -f supabase/seed.sql
fi

# Kill existing PostgREST if running
pkill -f "postgrest postgrest.conf" 2>/dev/null

# Start PostgREST
echo "🌐 Starting API server on http://127.0.0.1:3001..."
cd "$(dirname "$0")"
postgrest postgrest.conf &

echo ""
echo "✅ Database ready!"
echo ""
echo "   PostgreSQL: localhost:5432/lexia_crm"
echo "   API (REST): http://127.0.0.1:3001"
echo ""
echo "   Run 'npm run dev' to start the app"
echo ""
