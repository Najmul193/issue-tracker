#!/usr/bin/env sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec "$@"
