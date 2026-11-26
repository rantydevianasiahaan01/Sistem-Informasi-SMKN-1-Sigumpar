# Database Skema v2 — SMKN 1 Sigumpar

File migration dan seed yang dibuat dari **PDM v2** (PostgreSQL, 3NF), dipecah per service.
Ini adalah deliverable Sprint 3 untuk peran Developer: menyiapkan database
agar Sprint 4 bisa langsung mengerjakan back end dan API.

> **Penting:** skema v2 dibangun di **database baru yang kosong**.
> File ini belum memindahkan data dari skema lama (`init.sql` dan `migration_00x` di
> `backend/<service>/`). Pemindahan data dikerjakan di Sprint 4, setelah kode tiap
> service disesuaikan dengan kolom baru.

## Isi folder

```
database/v2/
├── jalankan_semua.sh                 menjalankan semua file dengan urutan benar
├── 000-umum/
│   └── migration_000_ekstensi_enum.sql   pgcrypto, 21 tipe ENUM, fungsi tolak_ubah_data()
├── <service>/                        auth, academic, learning, student, vocational, asset
│   ├── migration_001_skema_v2.sql    CREATE TABLE + INDEX + COMMENT
│   ├── migration_002_relasi_v2.sql   FOREIGN KEY
│   └── migration_003_aturan_v2.sql   CHECK, indeks khusus, trigger, VIEW
├── pgadmin/
│   ├── 01_bangun_database_v2.sql     semua migration + seed dalam satu file
│   └── 02_uji_database_v2.sql        23 uji, hasil tampil sebagai tabel
├── seed/
│   ├── seed_001_data_awal.sql        WAJIB: 8 role, tahun ajaran aktif, bobot UKK
│   └── seed_002_data_demo.sql        DEMO: guru, kelas, siswa, mapel, 1 akun per role
└── uji/
    ├── uji_migration.sql             23 uji struktur dan aturan bisnis
    ├── uji_login_akun_demo.js        cek semua akun demo bisa login
    └── bukti/                        log hasil uji (untuk sprint review)
```

| Service | Tabel | Foreign key | Aturan (003) |
|---|---:|---:|---|
| auth-service | 5 | 6 | username unik (case-insensitive), akun hanya dibuat Tata Usaha, audit_log append-only |
| academic-service | 17 | 24 | 1 tahun ajaran aktif, arsip_surat read-only |
| learning-service | 5 | 10 | rentang nilai evaluasi, view skor evaluasi & status perangkat |
| student-service | 15 | 34 | total bobot = 100, rentang nilai, periode pengembalian, lampiran BK, view nilai akhir |
| vocational-service | 18 | 33 | total bobot PKL/UKK = 100, perpindahan PKL permanen, view nilai PKL/UKK |
| asset-service | 5 | 7 | – |
| **Total** | **65** | **114** | 4 trigger, 5 view |

## Kenapa urutannya 001 → 002 → 003 untuk semua service

Semua service memakai **satu database PostgreSQL yang sama**, dan ada relasi lintas
service (contoh: `users.guru_id` → `guru`, `nilai_siswa.pengampu_id` → `pengampu`).
Jadi semua tabel dibuat dulu (001 semua service), baru relasinya (002), lalu aturan
dan view (003). `jalankan_semua.sh` sudah mengatur urutan ini.

## Cara menjalankan

**Jangan jalankan di database tim yang sekarang (`pkm_smkn1sigumpar`).** Tabelnya
sudah ada dan skemanya berbeda. Coba di PostgreSQL terpisah yang bisa dibuang:

```bash
# Dari root repo. Tidak perlu install psql: semua jalan di dalam container.
# 1. Nyalakan PostgreSQL 16 kosong (port 5433 agar tidak bentrok)
docker run -d --name pg-v2 -e POSTGRES_PASSWORD=postgres -p 5433:5432 \
  -v "$PWD/database/v2:/v2" postgres:16

# 2. Jalankan migration + seed + data demo (tunggu ±5 detik setelah langkah 1)
docker exec -e DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
  pg-v2 bash /v2/jalankan_semua.sh --demo

# 3. Uji aturan bisnis (hasil akhir harus: lulus 20, gagal 0)
docker exec pg-v2 psql -U postgres -f /v2/uji/uji_migration.sql

# 4. Hapus kalau sudah selesai mencoba (bisa diulang dari langkah 1)
docker rm -f pg-v2
```

Melihat isinya: buka DBeaver/pgAdmin ke `localhost:5433`, user `postgres`,
password `postgres`, database `postgres`; atau `docker exec -it pg-v2 psql -U postgres`
lalu `\dt`. Di PowerShell Windows, ganti `"$PWD/database/v2:/v2"` dengan
`"${PWD}/database/v2:/v2"` dan tulis tiap perintah dalam satu baris (tanpa `\`).

### Windows tanpa Docker (PostgreSQL di-install langsung)

```powershell
cd C:\lokasi\proyek-smk-n1-sigumpar-microservice-main
powershell -ExecutionPolicy Bypass -File database\v2\jalankan_semua.ps1 -Demo
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d pkm_v2 -f database\v2\uji\uji_migration.sql
```

Tambahkan `-Ulang` untuk menghapus `pkm_v2` dan membangunnya lagi dari nol.

### Lewat pgAdmin (tanpa terminal)

1. Klik kanan **Databases** → Create → Database → nama `pkm_v2` → Save.
2. Klik kanan `pkm_v2` → **Query Tool** → buka `pgadmin/01_bangun_database_v2.sql` → **F5**.
   Berhasil jika Data Output menampilkan `Selesai: 65 tabel, 8 akun`.
3. Di Query Tool yang sama, buka `pgadmin/02_uji_database_v2.sql` → **F5**.
   Muncul tabel 23 uji, kolom `hasil` harus LULUS semua. Data uji dibatalkan otomatis.
4. Mengulang dari nol: klik kanan `pkm_v2` → Delete, lalu kembali ke langkah 1.

File `01_bangun_database_v2.sql` adalah gabungan semua migration + seed (termasuk
data demo) dengan urutan yang sama seperti `jalankan_semua.sh`.

Uji login akun demo (opsional, perlu Node dan `npm install` di auth-service):
`DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres node database/v2/uji/uji_login_akun_demo.js`

Tanpa `--demo`, hanya seed wajib yang dijalankan (untuk server sekolah).
File seed aman dijalankan berulang; file migration tidak (khusus database kosong).

## Akun dibuat oleh Tata Usaha

Kolom `users.dibuat_oleh` mencatat akun Tata Usaha yang membuat setiap akun.
Trigger `trg_users_dibuat_tu` menolak akun baru jika pembuatnya bukan akun
Tata Usaha yang aktif, atau jika pembuatnya tidak dicatat. Satu-satunya
pengecualian adalah akun pertama saat tabel `users` masih kosong (admin TU dari `.env`).

Alur di aplikasi: TU mengisi **Data Guru** → membuat akun untuk guru itu dan
memilih **satu role** → sistem membuat password sementara (`harus_ganti_password = TRUE`)
→ guru login dan wajib mengganti password. Guru yang memegang beberapa jabatan
(misalnya Guru Mapel dan Wali Kelas) dibuatkan satu akun untuk setiap role.
Back end wajib mengisi `dibuat_oleh` dengan id akun TU yang sedang login
(dari JWT) dan mencatat aksinya di `audit_log`.

## Akun demo (hanya untuk laptop developer dan tester)

Password semua akun: **`Sigumpar#2026`**

| Username | Role | Guru |
|---|---|---|
| `kepsek.demo` | kepala-sekolah | Mangatas Simanjuntak |
| `waka.demo` | waka-sekolah | Rosmaida Sitorus |
| `tu.demo` | tata-usaha | – |
| `guru.demo` | guru-mapel | Hotman Pardede |
| `walikelas.demo` | wali-kelas | Hotman Pardede |
| `bk.demo` | bk | Lestari Hutapea |
| `pramuka.demo` | pramuka | Benny Silaban |
| `vokasi.demo` | vokasi | Juniar Manurung |

Hotman Pardede sengaja punya dua akun untuk menunjukkan aturan
**1 akun = 1 role**: guru boleh punya beberapa akun, tapi tidak dua akun dengan role sama.

**Jangan jalankan `seed_002_data_demo.sql` di server sekolah.** Akun Tata Usaha
pertama di server tetap dibuat oleh `auth-service` dari `ADMIN_AWAL_*` di `.env`.

## Hasil uji (lihat `uji/bukti/`)

- Semua file berjalan tanpa error di database kosong (PostgreSQL 16).
- `uji_migration.sql`: **23 dari 23 lulus**: jumlah tabel/FK/view sesuai PDM,
  akun per role, password tersimpan sebagai hash, 1 akun = 1 role,
  akun hanya bisa dibuat oleh Tata Usaha, arsip dan audit log
  tidak bisa diubah/dihapus, total bobot = 100, nilai akhir tanpa penilaian harian
  tidak dihitung 0 (82,25; dengan perilaku B = 85 menjadi 82,56).
- `uji_login_akun_demo.js`: **8 dari 8 akun** cocok dengan password demo, memakai
  fungsi `cocok()` yang sama dengan auth-service.
- Seed dijalankan dua kali: jumlah data tidak bertambah.

## Yang harus disesuaikan di Sprint 4

1. **`backend/auth-service/src/config/seed.js`**: masih memakai tabel `user_roles` dan
   memberi admin semua role. Di v2 tabel itu tidak ada: akun admin cukup diberi
   `role_id` = `tata-usaha` (dengan `dibuat_oleh` NULL, karena akun pertama). Ada 7 tempat di kode `.js` yang masih memakai `user_roles`.
2. Query di setiap service yang memakai kolom lama (contoh `siswa_id` TEXT, nama siswa
   atau guru yang disalin, bobot per baris nilai): ganti mengikuti
   `PERUBAHAN_PDM_v2.md`.
3. Bobot PKL (`pengaturan_pkl`) dan ambang predikat di `v_nilai_pkl` masih menunggu
   keputusan sekolah.
4. Opsional, lapis keamanan kedua: cabut hak UPDATE/DELETE dari user DB service, misalnya
   `REVOKE UPDATE, DELETE, TRUNCATE ON arsip_surat FROM academic_user;` dan
   `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM auth_user;`.
