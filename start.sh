#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

for dir in backend frontend; do
  if [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "Created $dir/.env from example"
  fi
done

echo "Building and starting services..."
docker compose -f docker/docker-compose.yml up --build -d

echo "Waiting for API..."
until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do
  sleep 2
done

echo ""
echo "  Frontend: http://localhost:5173"
echo "  API:      http://localhost:3000/api"
echo ""
