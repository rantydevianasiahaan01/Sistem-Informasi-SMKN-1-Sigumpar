-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : vocational-service (Pramuka, PKL, UKK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "kelas_pramuka" (
  "id" serial PRIMARY KEY,
  "nama_regu" varchar(100) NOT NULL,
  "tahun_ajaran_id" int
);

CREATE TABLE "anggota_regu" (
  "id" serial PRIMARY KEY,
  "regu_id" int NOT NULL,
  "siswa_id" int NOT NULL
);

CREATE TABLE "kegiatan_pramuka" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "deskripsi" varchar(255),
  "dibuat_oleh" uuid
);

CREATE TABLE "absensi_pramuka" (
  "id" serial PRIMARY KEY,
  "kegiatan_id" int NOT NULL,
  "siswa_id" int NOT NULL,
  "status" status_hadir_enum NOT NULL,
  "keterangan" text
);

CREATE TABLE "silabus_pramuka" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int,
  "judul_kegiatan" varchar(255) NOT NULL,
  "tanggal" date NOT NULL,
  "file_path" varchar(255),
  "file_nama" varchar(255),
  "file_mime" varchar(100),
  "dibuat_oleh" uuid
);

CREATE TABLE "laporan_pramuka" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int,
  "judul" varchar(255) NOT NULL,
  "deskripsi" text,
  "tanggal" date NOT NULL,
  "file_path" varchar(255),
  "file_nama" varchar(255),
  "file_mime" varchar(100),
  "dibuat_oleh" uuid
);

CREATE TABLE "perusahaan_pkl" (
  "id" serial PRIMARY KEY,
  "nama" varchar(150) NOT NULL,
  "alamat" text,
  "bidang_usaha" varchar(100)
);

CREATE TABLE "penempatan_pkl" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "perusahaan_id" int NOT NULL,
  "tahun_ajaran_id" int NOT NULL,
  "posisi" varchar(150),
  "pembimbing_industri" varchar(150),
  "kontak_pembimbing" varchar(100),
  "tanggal_mulai" date NOT NULL,
  "estimasi_selesai" date,
  "tanggal_berakhir" date,
  "foto_url" text,
  "deskripsi_pekerjaan" text,
  "status" status_penempatan_enum NOT NULL DEFAULT 'aktif'
);

CREATE TABLE "perpindahan_pkl" (
  "id" serial PRIMARY KEY,
  "penempatan_asal_id" int NOT NULL,
  "penempatan_tujuan_id" int UNIQUE NOT NULL,
  "urutan" smallint NOT NULL,
  "tanggal_pindah" date NOT NULL,
  "alasan" text NOT NULL,
  "disetujui_oleh" penyetuju_pindah_enum NOT NULL,
  "dokumen_pendukung" varchar(255),
  "dicatat_oleh" uuid,
  "dicatat_pada" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "koreksi_perpindahan" (
  "id" serial PRIMARY KEY,
  "perpindahan_id" int NOT NULL,
  "versi" smallint NOT NULL,
  "bagian_dikoreksi" varchar(50) NOT NULL,
  "nilai_sebelumnya" text,
  "nilai_koreksi" text NOT NULL,
  "alasan_koreksi" text NOT NULL,
  "dikoreksi_oleh" uuid,
  "dikoreksi_pada" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "laporan_progres_pkl" (
  "id" serial PRIMARY KEY,
  "penempatan_id" int NOT NULL,
  "minggu_ke" smallint NOT NULL,
  "deskripsi" text NOT NULL,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "pengaturan_pkl" (
  "tahun_ajaran_id" int PRIMARY KEY,
  "bobot_praktik" numeric(5,2) NOT NULL,
  "bobot_sikap" numeric(5,2) NOT NULL,
  "bobot_laporan" numeric(5,2) NOT NULL
);

CREATE TABLE "nilai_pkl" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "tahun_ajaran_id" int NOT NULL,
  "nilai_praktik" numeric(5,2),
  "nilai_sikap" numeric(5,2),
  "nilai_laporan" numeric(5,2),
  "catatan" text,
  "dinilai_oleh" uuid
);

CREATE TABLE "pengaturan_ukk" (
  "tahun_ajaran_id" int PRIMARY KEY,
  "bobot_praktik" numeric(5,2) NOT NULL DEFAULT 70,
  "bobot_sikap" numeric(5,2) NOT NULL DEFAULT 30,
  "updated_by" uuid
);

CREATE TABLE "soal_ukk" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "judul_tugas" varchar(255) NOT NULL,
  "instruksi" text NOT NULL,
  "link_lampiran" text,
  "file_path" varchar(255),
  "file_nama" varchar(255),
  "file_mime" varchar(100)
);

CREATE TABLE "progres_ukk" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "soal_id" int NOT NULL,
  "tahap" varchar(255) NOT NULL,
  "deskripsi" text,
  "link_bukti" text,
  "tanggal" date NOT NULL
);

CREATE TABLE "nilai_ukk" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "soal_id" int NOT NULL,
  "nilai_praktik" numeric(5,2),
  "nilai_sikap" numeric(5,2),
  "catatan_penguji" text,
  "dinilai_oleh" uuid
);

CREATE TABLE "sertifikat_ukk" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "nomor_sertifikat" varchar(100) UNIQUE NOT NULL,
  "tanggal_terbit" date,
  "predikat" varchar(50),
  "catatan" text,
  "file_path" varchar(255),
  "file_nama" varchar(255),
  "file_mime" varchar(100)
);

CREATE UNIQUE INDEX ON "anggota_regu" ("regu_id", "siswa_id");

CREATE UNIQUE INDEX ON "kegiatan_pramuka" ("kelas_tahun_ajaran_id", "tanggal");

CREATE UNIQUE INDEX ON "absensi_pramuka" ("kegiatan_id", "siswa_id");

CREATE UNIQUE INDEX ON "koreksi_perpindahan" ("perpindahan_id", "versi");

CREATE UNIQUE INDEX ON "laporan_progres_pkl" ("penempatan_id", "minggu_ke");

CREATE UNIQUE INDEX ON "nilai_pkl" ("siswa_id", "tahun_ajaran_id");

CREATE UNIQUE INDEX ON "nilai_ukk" ("siswa_id", "soal_id");

COMMENT ON TABLE "anggota_regu" IS 'nama_lengkap dihapus (ambil dari siswa)';

COMMENT ON TABLE "absensi_pramuka" IS 'nama_lengkap, nisn, kelas_id, tanggal dipindah/dihapus';

COMMENT ON TABLE "laporan_pramuka" IS 'Menggabungkan laporan_pramuka dan laporan_kegiatan';

COMMENT ON COLUMN "laporan_pramuka"."kelas_tahun_ajaran_id" IS 'NULL = laporan kegiatan umum';

COMMENT ON TABLE "penempatan_pkl" IS 'Menggantikan laporan_lokasi_pkl (nama_siswa, nisn, kelas, nama_perusahaan tidak disalin)';

COMMENT ON TABLE "perpindahan_pkl" IS 'Permanen (UPDATE/DELETE ditolak trigger). Siswa diambil dari penempatan asal. Perbaikan via koreksi_perpindahan';

COMMENT ON TABLE "pengaturan_pkl" IS 'CHECK total = 100. Bobot dipindah dari nilai_pkl';

COMMENT ON TABLE "nilai_pkl" IS 'nilai_akhir & predikat dihitung di VIEW v_nilai_pkl';

COMMENT ON TABLE "pengaturan_ukk" IS 'CHECK total = 100';

COMMENT ON COLUMN "soal_ukk"."kelas_tahun_ajaran_id" IS 'jurusan & tahun ajaran diturunkan dari rombel';

COMMENT ON TABLE "nilai_ukk" IS 'bobot dari pengaturan_ukk; nilai_akhir di VIEW v_nilai_ukk';

COMMENT ON COLUMN "sertifikat_ukk"."predikat" IS 'dari lembaga penguji, bukan hasil hitung';
