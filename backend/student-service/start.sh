#!/bin/bash
set -uo pipefail

if [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ] || [ -z "${DB_PASSWORD:-}" ] || [ -z "${DB_HOST:-}" ]; then
  echo "DB_USER, DB_NAME, DB_PASSWORD, dan DB_HOST wajib diisi dari file .env"
  exit 1
fi

DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${DB_PASSWORD}"

init_database() {
  ready=0
  for _ in $(seq 1 30); do
    if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done

  if [ "$ready" -ne 1 ]; then
    echo "PostgreSQL di ${DB_HOST}:${DB_PORT} belum siap setelah 30 detik"
    exit 1
  fi

  if [ -f ./init.sql ]; then
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f ./init.sql || true
  fi

  for f in ./migration_*.sql; do
    if [ -f "$f" ]; then
      psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "$f" || true
    fi
  done
}

init_database

# Volume host ./uploads biasanya milik root, sementara Node jalan sebagai delcom.
sudo mkdir -p /app/uploads/parenting /app/uploads/kebersihan
sudo chown -R "$(id -un):$(id -gn)" /app/uploads || sudo chmod -R a+rwX /app/uploads

exec npm start
