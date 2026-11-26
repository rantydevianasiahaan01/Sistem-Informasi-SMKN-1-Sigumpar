# Panduan Pengembangan

## Prasyarat

- Docker Desktop (Compose v2)
- Node.js 24 — hanya jika ingin menjalankan frontend di luar Docker

## Menjalankan seluruh stack

```bash
docker compose up -d --build
```

Alamat setelah semua container jalan:

| Alamat | Keterangan |
| --- | --- |
| http://localhost:8001 | Frontend dan API gateway (satu pintu) |
| http://localhost:8001/health | Health check gateway |

Melihat log satu service:

```bash
docker compose logs -f academic-service
```

Build ulang satu service saja:

```bash
docker compose up -d --build academic-service
```

## Frontend di luar Docker

```bash
cd frontend
npm install
npm run dev
```

Vite membaca `frontend/.env`. File itu **sengaja tidak ikut masuk ke image**
(lihat `frontend/.dockerignore`) supaya build container memakai nilai default
di kode (`http://localhost:8001` untuk API, `http://localhost:8080` untuk
akun awal) yang sudah cocok dengan `docker-compose.yml`.

## Variabel environment

Nilai untuk container di-set langsung di `docker-compose.yml`, bukan lewat file
`.env`. File `.env`, `backend/.env`, dan `frontend/.env` hanya untuk keperluan
lokal dan tidak ikut ter-commit (`.gitignore`) maupun ikut ke dalam image
(`.dockerignore`).

Variabel yang dipakai tiap service backend: `NODE_ENV`, `PORT`, `DB_HOST`,
`DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`. Keenamnya
menunjuk ke satu database yang sama — container `db` di `docker-compose.yml`. `student-service` dan
`vocational-service` juga memakai `ACADEMIC_SERVICE_URL`.

Frontend memakai `VITE_API_URL` dan `VITE_LEARNING_URL`. Di browser keduanya
hampir selalu kalah dari `window.location.origin` — lihat `src/api/apiOrigin.js`.

auth-service tambahan: `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_TTL_DETIK`,
`REFRESH_TTL_HARI`, `COOKIE_SECURE`, dan `ADMIN_AWAL_*` untuk akun tata usaha
pertama.

## Pengujian

Playwright dikonfigurasi di root (`playwright.config.ts`, folder `tests/`) dan
dijalankan di CI oleh `.github/workflows/playwright.yml` untuk push/PR ke
`main`.

```bash
npx playwright test
```

## Troubleshooting

**Service backend gagal konek database saat pertama kali start.**
`start.sh` menunggu PostgreSQL siap sebelum menjalankan `init.sql`. Container
`node:24-alpine` + PostgreSQL butuh waktu; cek `docker compose logs -f <service>`.

**Perubahan skema tidak muncul.** `init.sql` hanya berisi `CREATE TABLE IF NOT
EXISTS`, jadi tabel yang sudah ada tidak diubah. Tambahkan file
`migration_*.sql` — lihat [database.md](database.md).

**Frontend memanggil API ke port yang salah.** Periksa `VITE_API_URL`. Di dalam
container nilainya berasal dari `docker-compose.yml`; di lokal dari
`frontend/.env`.

**Container di-restart lalu gateway 502.** nginx memakai
`resolver 127.0.0.11 valid=10s` sehingga IP baru terdeteksi maksimal 10 detik.
Tidak perlu restart gateway manual.
