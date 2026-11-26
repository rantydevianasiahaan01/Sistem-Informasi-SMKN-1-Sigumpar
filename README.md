# Sistem Informasi Akademik SMK N1 Sigumpar

Aplikasi web berbasis microservice untuk pengelolaan akademik SMK N1 Sigumpar:
data kelas dan siswa, jadwal, nilai, absensi guru dan siswa, perangkat
pembelajaran, kegiatan pramuka, PKL, serta UKK.

**Stack:** React + Vite + Tailwind (frontend), Node.js + Express + PostgreSQL
(6 service backend), nginx sebagai API gateway, autentikasi dan role dikelola
sendiri oleh auth-service, Docker Compose untuk orkestrasi.

## Jalankan

```bash
docker compose up -d --build
```

| Alamat | Keterangan |
| --- | --- |
| http://localhost:8001 | Frontend (akses utama) |
| http://localhost:8001/api/auth | Auth Service API (login, akun, peran) |
| http://localhost:8001/api/academic | Academic Service API |
| http://localhost:8001/api/learning | Learning Service API |
| http://localhost:8001/api/student | Student Service API |
| http://localhost:8001/api/vocational | Vocational Service API |
| http://localhost:8001/api/auth | Auth Service API |

## Dokumentasi

Seluruh dokumen ada di [`docs/`](docs/):

- [Arsitektur](docs/arsitektur.md) — service, port, routing, alur autentikasi
- [Panduan pengembangan](docs/pengembangan.md) — setup, environment, troubleshooting
- [Database](docs/database.md) — skema per service dan konvensi migrasi
- [Penyimpanan file](docs/penyimpanan-file.md) — lokasi file unggahan dan cara backup
- [Struktur repo](docs/struktur-repo.md) — peta folder dan kode yang belum terpakai
- [Database v2](database/v2/README.md) — skema baru hasil PDM v2 (Sprint 3): migration, seed, akun demo, uji
- [Aturan kerja Git](CONTRIBUTING.md) — branch, commit, Pull Request, dan siapa yang boleh merge
