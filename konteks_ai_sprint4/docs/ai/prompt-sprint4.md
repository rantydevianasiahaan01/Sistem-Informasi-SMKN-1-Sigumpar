# Prompt AI untuk Sprint 4

Cara pakai:
1. `git checkout main && git pull`, lalu buat branch task (lihat `docs/sprint/sprint-4.md`).
2. Buka asisten AI **di folder root repo** (Claude Code: jalankan `claude` di folder repo;
   Cursor/VS Code Copilot: buka folder repo). AI otomatis membaca `AGENTS.md`/`CLAUDE.md`.
   Untuk AI berbasis chat web yang tidak bisa membaca folder, lampirkan `AGENTS.md`,
   `docs/keputusan.md`, `docs/sprint/sprint-4.md`, dan file yang disebut di prompt.
3. Salin prompt sesuai task. Selalu **baca hasilnya**, jalankan, lalu buat Pull Request.

> Urutan: **Prompt 0** (sekali per orang) → **Prompt 1** (spesifikasi API, harus selesai
> dan di-merge lebih dulu) → prompt task masing-masing.

---

## Prompt 0 — Cek pemahaman konteks (sekali, sebelum task pertama)

```
Baca AGENTS.md, docs/keputusan.md, dan docs/sprint/sprint-4.md. Jangan mengubah file apa pun.
Jelaskan singkat dalam Bahasa Indonesia:
1. arsitektur sistem dan service yang terkait task saya: <tulis task, mis. "API Input Nilai">,
2. file dan tabel yang kemungkinan perlu disentuh,
3. aturan bisnis yang berlaku untuk task itu,
4. hal yang masih belum jelas dan perlu saya tanyakan ke tim.
```

## Prompt 1 — Spesifikasi REST API (Daniel + Risky) · branch `dok/spesifikasi-api`

```
Task Sprint 4 #1: susun spesifikasi REST API untuk modul Input Nilai, BK, dan PKL.

Baca dulu: AGENTS.md, docs/keputusan.md, docs/api/README.md, database/v2/pdm_smkn1_sigumpar_pg.dbml
(tabel nilai_siswa, bobot_nilai, konversi_perilaku, penilaian_harian, nilai_harian, tabel BK,
penempatan/perpindahan PKL), serta route yang sudah ada di
backend/student-service/src/routes/studentRoutes.js dan backend/vocational-service/src/routes/.

Buat dua file:
1. docs/api/openapi.yaml (OpenAPI 3.0) berisi endpoint yang dibutuhkan halaman Sprint 4:
   - Input Nilai: daftar siswa + nilai per pengampu & semester, simpan/ubah nilai komponen,
     tambah & hapus kolom penilaian harian beserta nilainya, ambil & simpan bobot (total 100),
     ambil & simpan konversi perilaku A–E, ambil nilai akhir (komponen kosong = null).
   - BK: CRUD tanpa DELETE untuk Pemanggilan Orang Tua, Pendampingan & Pembinaan, Pengembalian
     Siswa; unggah lampiran (maks 5 MB, pdf/jpg/png); terbitkan surat dari template (pratinjau
     data + simpan ke arsip read-only).
   - PKL: ambil penempatan siswa dan riwayat perpindahan; tambah perpindahan (tanpa ubah/hapus).
   Untuk setiap endpoint tulis: deskripsi, role yang boleh (x-roles), parameter, request body,
   contoh respons sukses dan error (400/401/403/404/409).
2. docs/api/daftar-endpoint.md: tabel Modul | Method | Endpoint | Deskripsi | Role | Halaman Figma.

Aturan:
- Ikuti konvensi docs/api/README.md (snake_case sesuai kolom database/v2, format respons, null bukan 0).
- Pertahankan endpoint lama yang sudah dipakai front end; tandai yang baru dengan "(baru)".
- Untuk hal yang belum diputuskan (docs/keputusan.md T-01..T-03), tulis sebagai catatan
  "MENUNGGU KONFIRMASI", jangan mengarang aturan.
- Jangan mengubah kode aplikasi pada task ini.
Akhiri dengan ringkasan endpoint dan daftar pertanyaan terbuka.
```

## Prompt 2 — Migration tabel Sprint 4 (Hans) · branch `db/tabel-sprint4`

```
Task Sprint 4 #2: buat migration lanjutan untuk kebutuhan Sprint 4.

Baca: AGENTS.md bagian 6, docs/keputusan.md K-40 dan K-41, docs/database.md, database/v2/
(dbml dan file migration per service), backend/student-service/init.sql dan migration_*.sql,
backend/vocational-service/init.sql dan migration_*.sql, backend/auth-service/init.sql.

Buat file migration baru (nomor berikutnya di tiap service), idempoten, tanpa mengubah
init.sql atau migration lama:
- student-service: bobot_nilai, konversi_perilaku, penilaian_harian, nilai_harian, kolom baru
  yang diperlukan nilai_siswa (harian/perilaku, komponen boleh NULL), dan tabel BK
  (pemanggilan, pendampingan, pengembalian, lampiran, arsip surat BK read-only).
- auth-service: role baru 'bk'.
- vocational-service: tabel perpindahan PKL (permanen, tidak bisa diubah/dihapus).
Definisi kolom dan constraint mengikuti database/v2/, disesuaikan dengan tipe ID tabel existing
(cek tipe siswa_id, kelas_id, mapel_id, guru_id di init.sql).

Jelaskan setiap perbedaan dari database/v2 yang terpaksa dibuat. Sertakan cara mengetes:
docker compose up -d --build <service>, lalu cek tabel di pgAdmin (localhost:5433).
```

## Prompt 3 — Front end Input Nilai (Daniel) · branch `fitur/PB-05-input-nilai`

```
Task Sprint 4 #4: perbarui halaman Input Nilai sesuai desain Figma terbaru.

Baca: AGENTS.md, docs/keputusan.md K-01..K-05, docs/api/openapi.yaml (bagian Input Nilai),
halaman yang ada di frontend/src (route "/input-nilai" di App.jsx), frontend/src/api/studentApi.js.

Yang dibuat:
- Penilaian Harian sistem tambah: tombol "+ Tambah" membuka modal, kolom P1, P2, ... dinamis,
  state kosong bila belum ada penilaian harian.
- Kolom Harian (rata-rata), dropdown Nilai Perilaku A–E, modal Konversi Nilai Perilaku (diisi guru).
- Panel Atur Bobot dengan tambahan bobot Perilaku; validasi total = 100.
- Nilai kosong tampil "–" dan tidak dihitung; nilai akhir mengikuti rumus K-02.
Tambahkan fungsi API baru di frontend/src/api/studentApi.js sesuai openapi.yaml.
Jangan mengubah halaman lain. Akhiri dengan cara mengetes (login sebagai guru-mapel).
```

## Prompt 4 — API Input Nilai (Hans) · branch `fitur/PB-05-api-input-nilai`

```
Task Sprint 4 #5: implementasikan endpoint Input Nilai di student-service sesuai
docs/api/openapi.yaml.

Baca: AGENTS.md bagian 5–7, docs/keputusan.md K-01..K-04, docs/api/, migration Sprint 4 di
backend/student-service/, serta pola route/controller yang ada di backend/student-service/src.

Ketentuan:
- Periksa role dari header X-User-Role (guru-mapel untuk ubah data; role lain sesuai spesifikasi).
- Query berparameter; respons { success, message, data }; komponen kosong = null.
- Nilai akhir dihitung dengan rumus K-02 (bobot hanya dari komponen yang ada nilainya;
  perilaku dihitung hanya bila konversi A–E lengkap).
- Validasi: nilai 0–100, total bobot 100.
Jangan mengubah endpoint lama yang dipakai halaman lain. Akhiri dengan contoh request (curl)
untuk setiap endpoint.
```

## Prompt 5 — BK (front end: Daniel, API: Hans) · branch `fitur/PB-01-03-bk` / `fitur/PB-01-03-api-bk`

```
Task Sprint 4 #6/#7: <pilih: front end | API> modul BK.

Baca: AGENTS.md, docs/keputusan.md K-10..K-12 dan T-01, docs/api/openapi.yaml (bagian BK),
desain Figma BK (halaman BK, template surat, modal pratinjau cetak).

Front end: tiga submenu BK (Pemanggilan Orang Tua, Pendampingan & Pembinaan, Pengembalian Siswa),
form + tabel riwayat tanpa tombol hapus, unggah lampiran maks 5 MB, pratinjau surat dari template
lalu cetak. Menu hanya untuk role 'bk' (hasRole). Fungsi API di frontend/src/api/studentApi.js.
API: endpoint sesuai openapi.yaml di student-service, tanpa DELETE, upload dengan ekstensi dari
mimetype dan nama uuid (lihat docs/penyimpanan-file.md), arsip surat tidak bisa diubah.
Format nomor surat masih MENUNGGU KONFIRMASI (T-01): gunakan placeholder yang mudah diganti.
```

## Prompt 6 — Front end PKL (Hans + Daniel) · branch `fitur/PB-06-pkl`

```
Task Sprint 4 #8: halaman PKL penempatan dan riwayat perpindahan lokasi sesuai desain Figma PKL.
Baca: AGENTS.md, docs/keputusan.md K-20 dan K-21, docs/api/openapi.yaml (bagian PKL), halaman PKL
yang sudah ada di frontend/src/pages/vokasi/ dan frontend/src/api/vocationalApi.js.
API PKL baru dikerjakan Sprint 5: pakai endpoint yang sudah ada bila tersedia; untuk yang belum,
siapkan fungsi di vocationalApi.js sesuai openapi.yaml dan tampilkan state kosong.
Tidak ada menu sertifikat PKL. Riwayat perpindahan hanya bisa ditambah, tidak diubah/dihapus.
```

## Prompt 7 — Test plan (Giva) · branch `dok/test-plan`

```
Task Sprint 4 #11: susun test plan dan test case untuk Input Nilai dan BK.
Baca: AGENTS.md, docs/keputusan.md, docs/api/openapi.yaml, docs/sprint/sprint-4.md (DoD),
dan kriteria penerimaan dari System Analyst (jika sudah ada).
Buat docs/testing/test-plan-sprint4.md: ruang lingkup, lingkungan uji, akun/role yang dipakai,
lalu tabel test case (ID, skenario, langkah, data uji, hasil yang diharapkan, prioritas),
termasuk kasus batas: nilai kosong tampil "–", total bobot ≠ 100 ditolak, konversi perilaku
belum lengkap, role tanpa hak ditolak (403), unggah lampiran > 5 MB ditolak, arsip surat tidak
bisa diubah.
```

## Prompt 8 — Rencana keamanan/kriptografi (Giva) · branch `dok/rencana-keamanan`

```
Task Sprint 4 #10: susun rencana fitur keamanan (kriptografi) untuk sistem ini.
Baca: AGENTS.md, docs/arsitektur.md (bagian autentikasi dan sesi), backend/auth-service/src,
docs/penyimpanan-file.md, docs/keputusan.md.
Buat docs/keamanan/rencana-kriptografi.md: (1) mekanisme yang sudah ada (hash password, JWT RS256,
refresh token ter-hash, rotasi), (2) data sensitif yang perlu dilindungi (mis. catatan BK, lampiran,
data orang tua) dan usulan enkripsinya, (3) pengelolaan kunci, (4) rencana implementasi per sprint
dan cara membuktikannya saat demo. Jangan mengubah kode pada task ini.
```
