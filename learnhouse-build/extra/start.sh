#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# GLOBAL PORT SETTING:
# Force Next.js to run on 8000 so Nginx can listen on 3000
export PORT=8000

# Wait for database and redis if connection strings point to external services
# (In docker-compose, depends_on handles this, but useful for standalone)
if [ -n "$LEARNHOUSE_SQL_CONNECTION_STRING" ]; then
    DB_HOST=$(echo "$LEARNHOUSE_SQL_CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\1/p')
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
        echo "Waiting for external database at $DB_HOST..."
        timeout 30 sh -c 'until nc -z '"$DB_HOST"' 5432; do sleep 1; done' || true
    fi
fi

# Start the services
# Use server-wrapper.js for runtime environment variable injection
# CRITICAL CHANGE: We explicitly pass PORT=8000 to ensure Next.js doesn't default to 3000
PORT=8000 pm2 start server-wrapper.js --cwd /app/web --name learnhouse-web --update-env > /dev/null 2>&1

# Start Python backend (It uses LEARNHOUSE_PORT=9000 from Dockerfile)
pm2 start uv --cwd /app/api --name learnhouse-api -- run app.py

# Check if the services are running and log the status
pm2 status

# Start Nginx in the background
# It will listen on port 3000 and proxy to localhost:8000 (web) and localhost:9000 (api)
nginx -g 'daemon off;' &

# Tail PM2 logs with proper formatting
pm2 logs --raw