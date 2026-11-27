# AGENTS.md — Konteks Proyek untuk Asisten AI

File ini dibaca otomatis oleh asisten AI (Claude Code lewat `CLAUDE.md`, Codex,
Cursor, GitHub Copilot, Gemini CLI). Isinya adalah **"memori bersama" tim**: setiap
anggota yang memakai AI di repo ini mendapat aturan dan konteks yang sama.

> Asisten AI tidak berbagi ingatan antar-orang. Yang dibagikan adalah **file di repo
> ini**. Jika ada keputusan baru, tulis di `docs/keputusan.md` lewat Pull Request
> supaya AI semua anggota ikut tahu.

## 1. Proyek

Sistem Informasi Akademik **SMKN 1 Sigumpar** (existing system yang dikembangkan
ulang). Proyek Kolaborasi Semester 5 S1 Informatika IT Del 2026/2027, metode Scrum.

- Sprint 4 (25 Nov – 1 Des 2026): **front end + sebagian back end/API** untuk modul
  **Input Nilai → BK → PKL** (urutan prioritas). Rincian: `docs/sprint/sprint-4.md`.
- Bahasa: **Bahasa Indonesia** untuk teks UI, pesan error, komentar, commit, dan dokumen.

## 2. Arsitektur singkat

```
Browser → api-gateway (nginx, host :8001)
  /                → frontend (React 19 + Vite + Tailwind 3)
  /api/auth        → auth-service       :3005
  /api/academic    → academic-service   :3003
  /api/learning    → learning-service   :3006
  /api/student     → student-service    :3008   (nilai, wali kelas, BK)
  /api/vocational  → vocational-service :3007   (pramuka, PKL, UKK)
```

- Backend: Node.js + **Express 5**, PostgreSQL (`pg`/Sequelize, SQL mentah).
- **Satu database PostgreSQL bersama** untuk semua service.
- Autentikasi: login aplikasi sendiri, JWT RS256 (15 menit) + refresh token cookie
  `httpOnly`. nginx memverifikasi token lalu meneruskan header **`X-User-Id`** dan
  **`X-User-Role`** ke service. Detail: `docs/arsitektur.md`.
- `asset-service` belum dipakai (tidak ada di compose maupun nginx).

Dokumen wajib baca sebelum mengubah kode: `docs/arsitektur.md`, `docs/database.md`,
`docs/struktur-repo.md`, `docs/penyimpanan-file.md`.

## 3. Sumber kebenaran (baca sesuai tugas)

| Butuh tahu | Baca |
|---|---|
| Keputusan & aturan bisnis yang sudah disepakati | `docs/keputusan.md` |
| Rencana, PIC, branch, DoD Sprint 4 | `docs/sprint/sprint-4.md` |
| Kontrak API (endpoint, request/response, role) | `docs/api/` |
| Bentuk tabel target (PDM v2, 3NF) | `database/v2/` (`pdm_smkn1_sigumpar_pg.dbml`, `README.md`) |
| Tabel yang **sedang dipakai** sistem | `backend/<service>/init.sql` + `migration_*.sql` |
| Tampilan | Figma: Input Nilai & BK `figma.com/design/KVxCP0BxFlOtqFoV2MGNcd`, PKL `figma.com/design/KUK6SetBz9D5vSHXja8odf` |
| Aturan kerja Git | `CONTRIBUTING.md` |

Jika dokumen-dokumen ini bertentangan: **`docs/keputusan.md` menang**, lalu `docs/api/`,
lalu `database/v2/`. Jika tetap ragu, **berhenti dan tanyakan**, jangan menebak aturan
bisnis.

## 4. Aturan kerja untuk AI (wajib)

1. Kerjakan **hanya** lingkup task yang diminta. Jangan merapikan, mengganti nama, atau
   menghapus kode di luar task, walaupun terlihat tidak terpakai.
2. Jangan mengubah `main` langsung. Pastikan sedang di branch task
   (`fitur/PB-xx-...`, `perbaikan/...`, `db/...`, `dok/...`).
3. **Jangan pernah** membuat, membaca isi, atau meng-commit `.env`, `.env.*` (kecuali
   `.env.example`), atau isi `uploads/`.
4. Ikuti pola kode yang sudah ada di service/halaman yang sama sebelum membuat pola baru.
5. Endpoint baru **harus sesuai** `docs/api/`. Jika perlu endpoint yang belum ada di
   spesifikasi, tambahkan dulu di `docs/api/` dalam PR yang sama.
6. Perubahan database **hanya** lewat file migration baru (lihat bagian 6).
7. Setelah selesai, berikan ringkasan: file yang diubah, cara mengetes (halaman,
   role login), dan hal yang masih asumsi.
8. Jika membuat keputusan desain/aturan baru, usulkan tambahan untuk `docs/keputusan.md`.

## 5. Konvensi kode

**Backend (setiap service)**
- Struktur: `src/routes/*Routes.js` → `src/controllers/*Controller.js`; konfigurasi DB
  di `src/config/`. Ikuti pola query yang sudah dipakai controller di service itu.
- Query **selalu** berparameter (`$1, $2, ...`). Dilarang menyusun SQL dari string input.
- Format respons:
  - sukses: `{ "success": true, "message": "...", "data": ... }` (201 untuk create)
  - gagal: `{ "success": false, "message": "pesan dalam Bahasa Indonesia" }`
  - Kode: 400 input tidak valid, 401 belum login, 403 role tidak berhak, 404 tidak ada,
    409 bentrok/duplikat, 500 error server (jangan bocorkan detail SQL).
- Identitas & role pengguna diambil dari header **`X-User-Id`/`X-User-Role`** yang
  diisi gateway. Setiap endpoint yang mengubah data **wajib** memeriksa role.
- Upload: ekstensi ditentukan dari **mimetype**, nama file `prefiks-<uuid>.<ext>`,
  batas ukuran sesuai desain (BK: 5 MB). Lihat `docs/penyimpanan-file.md`.

**Frontend**
- Halaman di `frontend/src/pages/<role-atau-modul>/`, route & menu di `frontend/src/App.jsx`
  (menu digating dengan `hasRole()` dari `src/sesi.js`).
- Panggilan API **hanya** lewat file di `frontend/src/api/` yang memakai `axiosInstance`
  (token & refresh otomatis). Jangan memanggil `fetch`/`axios` langsung dari halaman.
- Tampilan mengikuti Figma; gunakan komponen yang sudah ada di `frontend/src/components/`.

## 6. Database

- Sistem berjalan di atas skema **existing** (`init.sql` + `migration_*.sql` per service,
  dijalankan otomatis oleh `start.sh` saat container start).
- `database/v2/` adalah **acuan bentuk tabel target**, bukan untuk dijalankan ke database
  sistem. Strategi Sprint 4: **migration lanjutan** per service yang menambah tabel/kolom
  yang dibutuhkan fitur, dengan definisi mengikuti `database/v2/`.
- Nama file: `backend/<service>/migration_<nnn>_<deskripsi>.sql` (nomor berikutnya).
- Migration **wajib idempoten** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
  karena dijalankan ulang setiap container start.
- **Jangan** mengubah `init.sql` atau migration lama yang sudah ada di `main`.

## 7. Aturan bisnis kunci (ringkas, detail di `docs/keputusan.md`)

- **Nilai akhir** = Σ(bobot × nilai) / Σ bobot **komponen yang ada nilainya**. Komponen
  kosong disimpan `NULL`, ditampilkan **"–"**, dan **tidak dihitung 0**.
- **Penilaian Harian** bersifat tambah (0..n kali per guru); kolom "Harian" = rata-rata.
- **Nilai Perilaku** A/B/C/D/E (Sangat baik … Sangat kurang). Nilai angka tiap predikat
  **diisi guru**; perilaku baru dihitung bila kelima konversinya terisi.
- **Total bobot** komponen nilai = **100**.
- **Akun** dibuat oleh **Tata Usaha**; 1 akun = 1 role (kecuali admin awal).
  **Jadwal upacara** hanya dikelola Tata Usaha.
- **Arsip surat** read-only setelah tersimpan; **audit log** hanya bisa ditambah.
- **Sertifikat PKL** tidak dibuat sistem (diterbitkan tempat PKL).
- Modul **BK** baru: role `bk` belum ada di sistem existing dan harus ditambahkan.

## 8. Menjalankan lokal

Lihat `docs/pengembangan.md`. Database tidak termasuk di `docker-compose.yml`; sekali saja:

```bash
docker network create --subnet 10.33.0.0/16 delcom-external-network
docker run -d --name external-pkm-smkn1-sigumpar-db --network delcom-external-network \
  --restart unless-stopped -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pkm_smkn1sigumpar \
  -p 5433:5432 -v smk_pgdata:/var/lib/postgresql/data postgres:16
cp .env.example .env
docker compose up -d --build      # buka http://localhost:8001
```
