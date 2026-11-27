# Sprint 4 — Implementasi Front End & Sebagian Back End/API

- **Periode:** 25 November – 1 Desember 2026
- **Sprint Goal:** Halaman utama modul Input Nilai, BK, dan PKL berjalan di front end dan
  terhubung ke sebagian API, dengan tabel baru mengikuti `database/v2/`.
- **Prioritas:** Input Nilai → BK → PKL (`docs/keputusan.md` K-42)
- **Sumber rencana:** Sprint Planning Sprint 4 di Coda. Jika berbeda, Coda yang benar;
  perbarui file ini lewat PR.

## Urutan kerja (ketergantungan)

```
1. Spesifikasi API (docs/api/)  ──┐
2. Migration tabel Sprint 4      ──┼──► 3. API back end ──► 5. Integrasi FE ↔ API ──► 6. Uji & review
                                   └──► 4. Front end (boleh mulai dengan data contoh sesuai docs/api/)
```

Front end dan back end bekerja paralel dengan **kontrak yang sama** di `docs/api/`.

## Task, PIC, dan branch

| # | Task | PIC | Jadwal | Branch |
|---|---|---|---|---|
| 1 | Spesifikasi REST API Input Nilai, BK, PKL (endpoint, request/response, kode error, role) | Daniel (Developer) + Risky (System Analyst) | 26 Nov | `dok/spesifikasi-api` |
| 2 | Migration lanjutan tabel Sprint 4 (penilaian harian, konversi perilaku, bobot nilai, tabel BK, role `bk`, perpindahan PKL) mengikuti `database/v2/` | Hans (Developer) | 26–27 Nov | `db/tabel-sprint4` |
| 3 | Handoff desain (komponen, warna, ukuran, revisi kecil) | Aditya (UI/UX Designer) | 26–27 Nov | – |
| 4 | Front end Input Nilai: penilaian harian dinamis, rata-rata Harian, Nilai Perilaku A–E, modal konversi, tampilan "–" | Daniel | 26–29 Nov | `fitur/PB-05-input-nilai` |
| 5 | API Input Nilai: simpan nilai, tambah penilaian harian, konversi perilaku, ambil nilai akhir | Hans | 26–30 Nov | `fitur/PB-05-api-input-nilai` |
| 6 | Front end BK: 3 submenu + pratinjau cetak surat | Daniel | 27 Nov–1 Des | `fitur/PB-01-03-bk` |
| 7 | API BK sebagian: simpan & ambil data 3 submenu, unggah lampiran, simpan arsip surat (read-only) | Hans | 28 Nov–1 Des | `fitur/PB-01-03-api-bk` |
| 8 | Front end PKL: penempatan + riwayat perpindahan (API di Sprint 5) | Hans + Daniel | 29 Nov–1 Des | `fitur/PB-06-pkl` |
| 9 | Konfirmasi aturan tertunda ke sekolah (T-01..T-03), kriteria penerimaan per item backlog, verifikasi hasil | Risky (System Analyst) | 26 Nov–1 Des | – |
| 10 | Rencana fitur keamanan (kriptografi): data yang dienkripsi, pengamanan token/password | Giva (Developer) | 27–28 Nov | `dok/rencana-keamanan` |
| 11 | Test plan & test case Input Nilai dan BK | Giva (QA) | 28 Nov–2 Des | `dok/test-plan` |
| 12 | Kelola repo, review & merge PR, koordinasi klien, pantau risiko, Sprint Review/Retro | Niken (Project Manager) | 25 Nov–1 Des | – |
| 13 | Daily Scrum & pembaruan Coda | Aditya (Scrum Master) | setiap hari | – |

## Definition of Done Sprint 4

- Halaman sesuai desain Figma dan bisa dibuka di `http://localhost:8001`.
- Alur **simpan dan tampilkan data** Input Nilai dan BK terhubung ke API dan database.
- Endpoint memeriksa role; menu hanya tampil untuk role yang berhak.
- Endpoint sesuai `docs/api/`; perubahan database lewat migration idempoten.
- Kode masuk `main` lewat Pull Request yang sudah direview PM; tercatat di Coda.
