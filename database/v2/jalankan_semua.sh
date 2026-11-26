#!/usr/bin/env bash
# Membangun database skema v2 dari NOL, dengan urutan yang benar.
#
# Pemakaian:
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/pkm_smkn1sigumpar_v2 \
#     ./jalankan_semua.sh            # skema + seed wajib
#   ... ./jalankan_semua.sh --demo   # + data demo (akun semua role)
#
# Lewat Docker (PostgreSQL terpisah, lihat README.md):
#   docker exec -e DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
#     pg-v2 bash /v2/jalankan_semua.sh --demo
# JANGAN arahkan ke database tim yang sekarang (pkm_smkn1sigumpar).
set -euo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:?Isi DATABASE_URL dulu}"

SERVICES=(auth-service academic-service learning-service student-service vocational-service asset-service)

export PGOPTIONS="-c client_min_messages=warning"

jalankan() {
  echo ">> $1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"
}

jalankan 000-umum/migration_000_ekstensi_enum.sql
# FK lintas service: semua tabel dibuat dulu (001), baru relasi (002), baru aturan (003)
for n in 001_skema 002_relasi 003_aturan; do
  for s in "${SERVICES[@]}"; do jalankan "$s/migration_${n}_v2.sql"; done
done

jalankan seed/seed_001_data_awal.sql
if [[ "${1:-}" == "--demo" ]]; then
  jalankan seed/seed_002_data_demo.sql
fi
echo "Selesai."
