#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Stopping services..."
docker compose -f docker/docker-compose.yml down

echo ""
echo "All services stopped."
echo "  Data is preserved in the postgres_data volume."
echo "  To also remove database data: ./stop.sh --clean"
echo ""

if [[ "${1:-}" == "--clean" ]]; then
  echo "Removing database volume..."
  docker compose -f docker/docker-compose.yml down -v
  echo "Database data removed."
fi
