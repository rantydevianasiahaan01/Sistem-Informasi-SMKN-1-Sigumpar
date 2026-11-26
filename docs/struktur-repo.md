# Struktur Repo

```
.
├── .github/workflows/    CI Playwright
├── backend/
│   ├── academic-service/     kelas, siswa, guru, mapel, jadwal, pengumuman, arsip
│   ├── asset-service/        BELUM dipakai (tidak ada di compose maupun nginx)
│   ├── auth-service/         verifikasi token, profil, foto, ganti password
│   ├── learning-service/     absensi guru, perangkat pembelajaran, review
│   ├── student-service/      nilai, absensi siswa, parenting, refleksi wali kelas
│   └── vocational-service/   pramuka, PKL, UKK
├── docs/                 dokumentasi (folder ini)
├── frontend/             React + Vite + Tailwind
├── nginx/nginx.conf      konfigurasi api-gateway
├── tests/                Playwright
└── docker-compose.yml
```

Isi tiap service backend: `Dockerfile`, `.dockerignore`, `start.sh`,
`init.sql`, `migration_*.sql`, `package.json`, dan `src/`.

## File yang dibaca oleh build

| File | Dibaca oleh |
| --- | --- |
| `backend/*/Dockerfile` | `docker compose build` |
| `backend/*/.dockerignore` | build context tiap service |
| `backend/*/start.sh` | entrypoint container (`CMD`) |
| `backend/*/init.sql`, `migration_*.sql` | `start.sh` |
| `frontend/Dockerfile`, `frontend/.dockerignore` | build frontend |
| `frontend/nginx.conf` | disalin ke `/etc/nginx/conf.d/default.conf` di image frontend |
| `nginx/nginx.conf` | di-mount ke container `api-gateway` |

`.dockerignore` hanya dibaca di **root build context**, yaitu `frontend/` dan
tiap `backend/<service>/`. Karena `docker-compose.yml` tidak punya build context
di root repo, `.dockerignore` di root tidak akan pernah terbaca — sengaja tidak
dibuat.

## Kode yang belum terpakai

Modul berikut tidak terjangkau dari entry point `frontend/src/main.jsx`
(ditelusuri lewat rantai import). Sebagian tampaknya sisa scaffold, sebagian
lagi fitur yang selesai dibuat tapi belum dipasang ke routing di `App.jsx`.
Belum dihapus supaya pemiliknya yang memutuskan.

**Sisa scaffold / sudah digantikan**

- `src/pages/Dashboard.jsx`, `src/components/layout/AppShell.jsx`
- `src/pages/UsersPage.jsx`, `src/hooks/useUsers.js`, `src/components/users/UserForm.jsx`
- `src/pages/TodosPage.jsx`, `src/hooks/useTodos.js`, `src/api/todosApi.js`
  (memanggil `/api/todos`, rute yang tidak ada di nginx; backendnya ada di
  `asset-service` yang juga belum jalan)
- `src/components/role/RolePage.jsx`, `src/components/ui/Badge.jsx`, `src/components/ui/Modal.jsx`

**Fitur yang belum dipasang ke routing**

- `src/pages/wakil-kepala-sekolah/perangkat-pembelajaran/` (2 halaman + dialog)
- `src/pages/wakil-kepala-sekolah/program-kerja/` (halaman + dialog)
- `src/pages/wakil-kepala-sekolah/supervisi/` (halaman + dialog)
- `src/pages/wakil-kepala-sekolah/WakakurLaporanPage.jsx`
- `src/pages/pramuka/regu/ReguPage.jsx`, `src/pages/pramuka/anggota_regu/AnggotaReguPage.jsx`
- `src/pages/kepala-sekolah/KepsekDashboardPage.jsx`

**Helper tanpa pemakai**

- `src/api/absensiSiswaApi.js`, `src/api/guruApi.js`, `src/api/wakilKepsekApi.js`
- `src/hooks/useTeacherAttendance.js`, `src/utils/fileUtils.js`

Di backend:

- `backend/asset-service/` belum terdaftar di `docker-compose.yml` maupun
  `nginx/nginx.conf`, dan konfigurasinya di `backend/.env` masih dikomentari.
- `backend/student-service/src/middleware/upload.js` tidak pernah di-require —
  `studentRoutes.js` mendefinisikan multer-nya sendiri untuk folder
  `uploads/parenting` dan `uploads/kebersihan`.
