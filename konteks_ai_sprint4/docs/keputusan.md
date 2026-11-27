# Catatan Keputusan Proyek

Daftar keputusan yang **sudah disepakati** tim dan/atau klien. Ini sumber kebenaran
tertinggi untuk aturan bisnis (lihat `AGENTS.md`). Setiap keputusan baru ditambahkan
lewat Pull Request, dengan tanggal dan siapa yang memutuskan. Keputusan lama yang
berubah **jangan dihapus**: beri status *Diganti* dan tulis penggantinya.

Format: **K-<nomor>** · tanggal · status · sumber

---

## Input Nilai

**K-01 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Penilaian Harian memakai **sistem tambah**: guru menambah kolom penilaian harian sebanyak
yang dilakukan (bisa 0, 1, 2, atau lebih). Kolom **Harian** pada tabel nilai = rata-rata
seluruh penilaian harian siswa tersebut.

**K-02 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Komponen nilai yang belum/tidak dinilai disimpan **`NULL`**, ditampilkan **"–"**, dan
**tidak ikut dihitung** (bukan dihitung 0). Rumus:

```
Nilai Akhir = Σ (bobot komponen × nilai komponen) / Σ bobot komponen yang ada nilainya
```

Contoh: Tugas 80, Kuis 85, UTS 78, UAS 82, Praktik 88, tanpa Harian, Perilaku B (=85)
→ (10·80 + 10·85 + 20·78 + 25·82 + 15·88 + 10·85) / 90 = **82,56**.
(Jika Harian dihitung 0 hasilnya 74,3, yang tidak adil bagi siswa.)

**K-03 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Bobot default (total **100**), bisa diubah guru di panel *Atur Bobot*, total wajib 100:
Harian 10 · Tugas 10 · Kuis 10 · UTS 20 · UAS 25 · Praktik 15 · Perilaku 10.
Catatan: tabel `nilai_siswa` existing masih punya default lama (20/10/25/30/15, tanpa
Harian & Perilaku). Bobot baru disimpan per pengampu & semester (`bobot_nilai` di
`database/v2/`), tidak per baris nilai.

**K-04 · Nov 2026 · Berlaku · Tim (Sprint 3), menggantikan usulan persetujuan Waka/Kepsek**
**Nilai Perilaku** berupa predikat: A = Sangat baik, B = Baik, C = Cukup, D = Kurang,
E = Sangat kurang. Nilai angka untuk tiap predikat **diisi oleh guru** (modal *Konversi
Nilai Perilaku*), tanpa alur persetujuan Waka/Kepsek. Perilaku **baru ikut dihitung**
setelah kelima konversi (A–E) terisi; sebelum itu dianggap kosong (K-02).

**K-05 · Nov 2026 · Berlaku · Tim**
Riwayat Input Nilai sudah ada di sistem existing; tombol **Riwayat** di halaman Input Nilai
membuka halaman riwayat tersebut.

## BK (Bimbingan Konseling)

**K-10 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Modul BK baru dengan tiga submenu: **Pemanggilan Orang Tua**, **Pendampingan & Pembinaan
Orang Tua**, **Pengembalian Siswa kepada Orang Tua**. Role baru **`bk`** (Guru BK) perlu
ditambahkan; role ini belum ada di sistem existing.

**K-11 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Surat BK dibuat **dari template** yang terisi otomatis dari data form, dengan **pratinjau**
sebelum dicetak. Surat yang sudah diterbitkan disimpan sebagai **arsip read-only**
(tidak bisa diubah/dihapus).

**K-12 · Nov 2026 · Berlaku · Definition of Done Mockup BK (Sprint 3)**
Data BK **tidak punya tombol hapus** (anti-delete). Unggah lampiran maksimal **5 MB**.

## PKL

**K-20 · Nov 2026 · Berlaku · PB-07 dropped**
**Sertifikat PKL tidak dibuat oleh sistem**: sertifikat diterbitkan langsung oleh instansi
tempat PKL. Menu sertifikat PKL dihapus dari desain.

**K-21 · Nov 2026 · Berlaku · Tim (Sprint 3)**
Riwayat perpindahan lokasi PKL mencatat tanggal, alasan, dan pihak penyetuju; data
perpindahan bersifat **permanen** (tidak bisa diubah/dihapus).

## Akun & Hak Akses

**K-30 · Nov 2026 · Berlaku · Klien/Tim**
Akun dibuat **oleh Tata Usaha** (halaman Data Guru). Satu akun = satu role; guru yang
memegang dua jabatan (mis. Guru Mapel + Wali Kelas) dibuatkan dua akun. Pengecualian:
akun admin awal dari `.env` (lihat `docs/arsitektur.md`). Akun baru wajib ganti password
saat login pertama.

**K-31 · Nov 2026 · Berlaku · Klien/Tim**
**Jadwal upacara** hanya bisa dikelola oleh **Tata Usaha**; role lain hanya melihat.

## Database & Proses

**K-40 · 25 Nov 2026 · Berlaku · Tim (Sprint 3)**
`database/v2/` (PDM v2, PostgreSQL, 3NF) adalah **acuan bentuk tabel**. Arsip surat
read-only, audit log append-only, dicegah oleh trigger di database.

**K-41 · 26 Nov 2026 · Berlaku · Tim (Sprint 4)**
Sistem tetap berjalan di skema existing. Perubahan untuk Sprint 4 dibuat sebagai
**migration lanjutan per service** (idempoten) dengan definisi tabel mengikuti
`database/v2/`. Perpindahan penuh ke skema v2 dicicil di sprint berikutnya.

**K-42 · 26 Nov 2026 · Berlaku · PM**
Prioritas Sprint 4: **Input Nilai → BK → PKL** (urgensi akhir semester, kesiapan
kebutuhan, ketergantungan, risiko). API PKL dilanjutkan di Sprint 5.

**K-43 · 26 Nov 2026 · Berlaku · PM**
Tidak ada push langsung ke `main`. Semua perubahan lewat Pull Request; **hanya PM yang
melakukan merge**. Dilarang `git push --force`. Lihat `CONTRIBUTING.md`.

---

## Belum diputuskan (jangan diasumsikan; tanyakan ke System Analyst/PM)

| ID | Pertanyaan | Menunggu |
|---|---|---|
| T-01 | Format penomoran surat BK | Konfirmasi SMKN 1 Sigumpar |
| T-02 | Bobot komponen nilai PKL | Konfirmasi SMKN 1 Sigumpar |
| T-03 | Batas nilai untuk predikat PKL | Konfirmasi SMKN 1 Sigumpar |
