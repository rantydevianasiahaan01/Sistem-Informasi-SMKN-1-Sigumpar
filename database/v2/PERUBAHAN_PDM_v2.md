# PDM v2 — Perubahan terhadap skema repo saat ini

PostgreSQL 15 · 65 tabel · 5 view · dikelompokkan per microservice · target 3NF

## Isi paket

| File | Kegunaan |
| --- | --- |
| `pdm_smkn1_sigumpar_pg.dbml` | PDM lengkap untuk dbdiagram.io (semua service, dikelompokkan TableGroup) |
| `per_service/pdm_0X_*.dbml` | PDM per service; tabel abu-abu = tabel milik service lain |
| `pdm_tables_postgres.sql` | DDL tabel, enum, FK (hasil ekspor DBML) |
| `pdm_views_triggers.sql` | Indeks khusus, CHECK, trigger read-only/append-only, VIEW nilai akhir |

Kedua file `.sql` sudah dijalankan berurutan di PostgreSQL 16 kosong tanpa error, dan diuji dengan data contoh.

> Ini rancangan **target**. Untuk database yang sudah berisi data, terapkan lewat file
> `migration_<nnn>_<deskripsi>.sql` per service (sesuai `docs/database.md`), bukan dengan
> menjalankan ulang `init.sql`. Sertakan pemindahan data lama di setiap migration.

## Prinsip normalisasi yang dipakai

- **Tidak menyalin data master.** Kolom seperti `nama_siswa`, `nisn`, `nama_kelas`, `guru_nama`,
  `user_nama`, `wali_kelas_nama` dihapus; ambil lewat relasi atau API service pemiliknya.
- **Tidak menyimpan kolom turunan.** `nilai_akhir`, `predikat`, `skor` dihitung di VIEW.
- **Tidak menyimpan konfigurasi di setiap baris.** Bobot dipindah ke tabel pengaturan.
- **Tidak memakai JSONB untuk data berkolom tetap** (penilaian kebersihan, evaluasi guru).
- **`pengampu`** (guru × mapel × rombel) menjadi poros nilai, jadwal, dan catatan mengajar.

## Perubahan per service

### auth-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `user_roles` (banyak role per akun) | `users.role_id` NOT NULL | Aturan baru: 1 akun = 1 role |
| — | UNIQUE (`guru_id`, `role_id`) | Guru boleh punya beberapa akun, tapi tidak dua akun dengan role sama |
| — | `users.dibuat_oleh` (FK ke `users`) + trigger `trg_users_dibuat_tu` | Akun hanya bisa dibuat oleh akun Tata Usaha yang aktif |
| 7 role | + role `bk` | Modul BK |
| `audit_log` (khusus akun, `target_user_id`) | `audit_log` umum: `service`, `entitas`, `entitas_id`, `data_lama`, `data_baru` | Dipakai semua service; append-only via trigger |

### academic-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `kelas.wali_kelas_id/nama` | dipindah ke `kelas_tahun_ajaran.wali_kelas_guru_id` | Wali kelas bergantung pada tahun ajaran |
| `siswa.kelas_id` | dihapus; pakai `siswa_kelas_tahun_ajaran` | Kelas siswa bergantung pada tahun ajaran |
| `mata_pelajaran.kelas_id`, `guru_mapel_id/nama` | tabel baru `pengampu` | Satu mapel diajar banyak guru di banyak kelas |
| `jadwal_mengajar.guru_id/nama, kelas_id, mapel_id, mata_pelajaran` | `jadwal_mengajar.pengampu_id` | Data guru/kelas/mapel tidak disalin |
| `jadwal_piket.user_id/user_nama` | `guru_id` + `dibuat_oleh` | Petugas = orang, bukan akun |
| `jadwal_upacara.user_id/user_nama` | `petugas_guru_id` + `dibuat_oleh` (wajib, role TU) | Hanya TU yang mengelola |
| `arsip_surat` dapat diubah | **read-only** (trigger), revisi via `menggantikan_id` | Arsip tidak boleh diubah |
| `guru.mata_pelajaran` (teks) | dihapus | Turunan dari `pengampu` |
| `supervisi_guru.guru_id, kelas, mata_pelajaran` | `pengampu_id` | Tidak menyalin teks |
| `program_kerja.penanggung_jawab` (teks) | `penanggung_jawab_guru_id` | Relasi ke guru |
| — | tabel baru `orang_tua` | Dibutuhkan modul BK |

### learning-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `absensi_guru.user_id, nama_guru, mata_pelajaran, id_absensiguru` | `guru_id` | Absensi per orang; guru bisa punya beberapa akun |
| `catatan_mengajar.guru_id, nama_guru, kelas_id, mapel_id, mata_pelajaran` | `pengampu_id` | Tidak menyalin data |
| `review_kepsek` + `review_wakasek` | `review_perangkat` (+ `peran_reviewer`) | Struktur sama |
| `perangkat_pembelajaran.status_review, catatan_review, reviewed_*` | dihapus; VIEW `v_status_perangkat` | Duplikat dari tabel review |
| `evaluasi_guru.penilaian` (JSONB), `nama_guru`, `evaluator_nama/role`, `skor`, `predikat` | 5 kolom aspek + `evaluator_user_id`; skor di VIEW | 1NF & 3NF |

### student-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `nilai_siswa.bobot_*` di setiap baris | tabel `bobot_nilai` per pengampu & semester (7 komponen) | Bobot bukan atribut siswa |
| `nilai_siswa.kelas_id, mapel_id, guru_id, tahun_ajar` | `pengampu_id` | Turunan dari pengampu |
| `nilai_siswa.nilai_akhir`, default 0 | dihapus (VIEW `v_nilai_akhir`); nilai kosong = NULL | Nilai kosong tidak dihitung |
| — | `konversi_perilaku`, `penilaian_harian`, `nilai_harian`, `riwayat_nilai` | Desain Input Nilai terbaru |
| `absensi_siswa` dengan `jadwal_id` NULL | dipisah menjadi `presensi_harian` | Dua konsep berbeda |
| `kebersihan_kelas.penilaian` (JSONB) | 5 kolom aspek | 1NF |
| `catatan_parenting`, `refleksi_wali_kelas`, `kebersihan_kelas` pakai `kelas_id`, `wali_id` | `kelas_tahun_ajaran_id` + `dibuat_oleh` | Wali kelas turunan dari rombel |
| `surat_panggilan_siswa` | `pemanggilan_ortu` | Desain BK |
| — | `pendampingan_ortu`, `pengembalian_siswa`, `lampiran_bk` | Modul BK; log BK memakai `audit_log` |

### vocational-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `laporan_lokasi_pkl` (siswa_id TEXT, nama/nisn/kelas disalin) | `perusahaan_pkl` + `penempatan_pkl` | 3NF, tipe FK benar |
| — | `perpindahan_pkl` (permanen, trigger) + `koreksi_perpindahan` | Desain Menu PKL |
| `laporan_progres_pkl.siswa_id, kelas_id, nama_siswa, nisn` | `penempatan_id` | Turunan dari penempatan |
| `nilai_pkl` bobot & `nilai_akhir`, `predikat` | `pengaturan_pkl` + VIEW `v_nilai_pkl` | 3NF |
| `nilai_ukk.bobot_*`, `nilai_akhir`, nama | bobot dari `pengaturan_ukk` (per tahun ajaran) + VIEW `v_nilai_ukk` | 3NF |
| `soal_ukk.jurusan, kelas_id, nama_kelas, tahun_ajaran` | `kelas_tahun_ajaran_id` | Turunan dari rombel |
| `absensi_pramuka` (kelas, nama, nisn, tanggal per siswa) | `kegiatan_pramuka` + `absensi_pramuka` | Tanggal & kelas milik kegiatan |
| `laporan_pramuka` + `laporan_kegiatan` | `laporan_pramuka` (kelas opsional) | Struktur sama |
| `anggota_regu.nama_lengkap` | dihapus | Ambil dari siswa |
| `sertifikat_ukk.nama_siswa, kelas_id, nama_kelas` | dihapus | Ambil dari siswa |

### asset-service
| Sebelum | Sesudah | Alasan |
| --- | --- | --- |
| `peminjaman_barang.barang_id` tanpa tabel induk | tabel baru `barang` | Integritas referensial |
| `respon_pengajuan_bendahara` + `respon_pengajuan_kepsek` | `respon_pengajuan` (+ `peran_responden`) | Struktur sama |
| `informasi_pengajuan` | tidak dimasukkan | Fungsinya belum jelas; perlu dikonfirmasi tim |

## Hal yang perlu diputuskan tim

1. **Ambang predikat PKL** di `v_nilai_pkl` (A ≥ 90, B ≥ 80, C ≥ 70) masih asumsi.
2. **Kolom file BYTEA** (`file_data`) tidak dimasukkan; PDM ini memakai `file_path`. Jika tim tetap ingin
   menyimpan file di database, tambahkan kembali kolomnya.
3. **FK antar-service**: karena satu database bersama, FK lintas service bisa dipasang. Jika tiap service
   kelak dipisah database, ubah FK lintas service menjadi kolom ID biasa.
