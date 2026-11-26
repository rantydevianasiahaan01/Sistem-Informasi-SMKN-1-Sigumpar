# Arsitektur

## Gambaran umum

```
Browser
   |
   v
api-gateway (nginx)  :8001 -> :80
   |-- /                  -> frontend       :5173   (nginx serve build Vite)
   |-- /api/auth          -> auth-service    :3005
   |-- /api/academic      -> academic-service:3003
   |-- /api/learning      -> learning-service:3006
   |-- /api/student       -> student-service :3008
   |-- /api/vocational    -> vocational-service :3007
   |
   +-- auth_request /auth-verify -> auth-service /api/auth/verify
```

## Daftar service

| Service | Port internal | Prefix API | Database |
| --- | --- | --- | --- |
| `auth-service` | 3005 | `/api/auth` | `smk_db` |
| `academic-service` | 3003 | `/api/academic` | `smk_db` |
| `learning-service` | 3006 | `/api/learning` | `smk_db` |
| `student-service` | 3008 | `/api/student` | `smk_db` |
| `vocational-service` | 3007 | `/api/vocational` | `smk_db` |
| `api-gateway` | 80 (host 8001) | — | — |
| `frontend` | 5173 | — | — |

Semua service backend memakai **satu PostgreSQL bersama** di container `db`
(`postgres:15`), alamatnya dari `DB_HOST` di `.env`. Container service hanya
membawa `postgresql-client` untuk menjalankan `init.sql` dan `migration_*.sql`
lewat `start.sh`.

`asset-service` ada di `backend/` tetapi **belum terdaftar di
`docker-compose.yml` maupun di nginx**, jadi saat ini tidak ikut jalan.

## Autentikasi

1. Pengguna masuk lewat halaman login aplikasi sendiri
   (`frontend/src/pages/LoginPage.jsx`). Sesi dikelola `frontend/src/sesi.js`.
   Tidak ada server autentikasi terpisah — Keycloak sudah dilepas.
2. Setiap request ke `/api/*` membawa header `Authorization: Bearer <token>`.
3. nginx menjalankan subrequest `auth_request /auth-verify` ke
   `auth-service /api/auth/verify`. Hasilnya di-cache 60 detik per token
   (`proxy_cache token_cache`); respons 401/403 tidak di-cache.
4. auth-service mengembalikan header `X-User-Id` dan `X-User-Role`, yang
   diteruskan nginx ke service tujuan.

Rute `/api/auth` tidak melewati `auth_request`. Rute `*/uploads/` sebagian
besar juga tidak — file upload dilayani langsung oleh service pemiliknya, dan
foto dimuat lewat `<img src>` yang tidak bisa mengirim header `Authorization`.
Pengecualiannya lampiran arsip surat (`/uploads/` dan `/api/academic/uploads/`),
yang seluruh pemakainya memakai `fetch`/`axios` sehingga bisa diverifikasi.
Lihat [penyimpanan-file.md](penyimpanan-file.md) untuk aturan penamaan dan
pembatasan penyajiannya.

## Sesi

Access token RS256 berumur 15 menit, hanya disimpan di memori browser. Yang
membuat sesi bertahan adalah refresh token: nilai acak yang dikirim sebagai
cookie `httpOnly` dan disimpan **ter-hash** di tabel `refresh_tokens`, jadi
isinya tidak bisa dibaca JavaScript maupun dipakai ulang dari isi tabel.

Setiap kali dipakai, refresh token dirotasi. Kalau token yang sudah dirotasi
muncul lagi, itu tanda salinannya dicuri — seluruh sesi pemiliknya langsung
dicabut, bukan cuma request itu yang ditolak.

Kunci penandatangan disimpan di tabel `jwt_keys` dan dibuat sendiri saat
auth-service pertama kali start. Kunci publiknya terbuka di
`/api/auth/.well-known/jwks.json`, supaya service lain bisa memverifikasi
token sendiri tanpa perlu memanggil auth-service tiap request.

## Role

Tujuh peran, disimpan di tabel `roles` milik auth-service:

`kepala-sekolah`, `waka-sekolah`, `tata-usaha`, `wali-kelas`, `guru-mapel`,
`pramuka`, `vokasi`.

Frontend menggating menu dan route dengan `hasRole()` di `frontend/src/App.jsx`.

## Akun

Akun dibuat tata usaha dari halaman **Data Guru** — satu formulir untuk data
kepegawaian sekaligus akun loginnya. Guru dan akun berada di database yang
berbeda (`academic_db` dan `auth_db`) dan dihubungkan lewat kolom
`users.guru_id`. Keduanya sengaja tidak dibuat dalam satu transaksi: kalau
pembuatan akun gagal, data guru tetap tersimpan dan bisa diulang.

Akun baru dan akun yang passwordnya direset ditandai `harus_ganti_password`,
sehingga halaman login langsung meminta password baru sebelum melanjutkan.

Akun administrator pertama dibuat otomatis dari `ADMIN_AWAL_USERNAME` dan
`ADMIN_AWAL_PASSWORD` di `.env`, hanya ketika tabel `users` masih kosong.

Akun itu — dan **hanya** akun itu — memegang ketujuh peran sekaligus, supaya
bisa membuka setiap menu saat menyiapkan sistem atau menelusuri masalah. Akun
lain tetap satu peran seperti biasa. Kelengkapan peran admin dipasang ulang
setiap auth-service start, jadi peran yang baru ditambahkan ke daftar otomatis
ikut terpasang dan akun admin tidak bisa tertinggal dengan hak yang berkurang.

Sebagai pengamannya, peran dan status aktif akun admin tidak bisa diubah lewat
`PATCH /api/auth/users/:id` — salah klik di sana bisa mengunci semua orang di
luar sistem. Nama dan emailnya tetap bisa disunting, dan passwordnya tetap bisa
direset.
