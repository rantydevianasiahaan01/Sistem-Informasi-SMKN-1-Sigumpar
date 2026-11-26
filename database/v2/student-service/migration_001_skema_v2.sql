-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : student-service (nilai, wali kelas, BK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "bobot_nilai" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "semester" semester_enum NOT NULL,
  "bobot_harian" numeric(5,2) NOT NULL DEFAULT 10,
  "bobot_tugas" numeric(5,2) NOT NULL DEFAULT 10,
  "bobot_kuis" numeric(5,2) NOT NULL DEFAULT 10,
  "bobot_uts" numeric(5,2) NOT NULL DEFAULT 20,
  "bobot_uas" numeric(5,2) NOT NULL DEFAULT 25,
  "bobot_praktik" numeric(5,2) NOT NULL DEFAULT 15,
  "bobot_perilaku" numeric(5,2) NOT NULL DEFAULT 10
);

CREATE TABLE "konversi_perilaku" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "predikat" predikat_perilaku_enum NOT NULL,
  "nilai_angka" numeric(5,2) NOT NULL
);

CREATE TABLE "nilai_siswa" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "pengampu_id" int NOT NULL,
  "semester" semester_enum NOT NULL,
  "tugas" numeric(5,2),
  "kuis" numeric(5,2),
  "uts" numeric(5,2),
  "uas" numeric(5,2),
  "praktik" numeric(5,2),
  "predikat_perilaku" predikat_perilaku_enum,
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "riwayat_nilai" (
  "id" serial PRIMARY KEY,
  "nilai_id" int NOT NULL,
  "komponen" varchar(20) NOT NULL,
  "nilai_lama" varchar(10),
  "nilai_baru" varchar(10),
  "diubah_oleh" uuid,
  "diubah_pada" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "penilaian_harian" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "semester" semester_enum NOT NULL,
  "urutan" smallint NOT NULL,
  "judul" varchar(150) NOT NULL,
  "jenis" jenis_harian_enum NOT NULL,
  "tanggal" date NOT NULL,
  "keterangan" text
);

CREATE TABLE "nilai_harian" (
  "id" serial PRIMARY KEY,
  "penilaian_harian_id" int NOT NULL,
  "siswa_id" int NOT NULL,
  "nilai" numeric(5,2)
);

CREATE TABLE "absensi_siswa" (
  "id" serial PRIMARY KEY,
  "jadwal_id" int NOT NULL,
  "siswa_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "status" status_hadir_enum NOT NULL,
  "keterangan" text,
  "dicatat_oleh" uuid
);

CREATE TABLE "presensi_harian" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "status" status_hadir_enum NOT NULL,
  "keterangan" text,
  "dicatat_oleh" uuid
);

CREATE TABLE "catatan_parenting" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "kehadiran_ortu" smallint DEFAULT 0,
  "agenda" varchar(255) NOT NULL,
  "ringkasan" text,
  "dokumentasi_url" text,
  "dibuat_oleh" uuid
);

CREATE TABLE "kebersihan_kelas" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "meja_kursi" kondisi_kebersihan_enum,
  "lantai" kondisi_kebersihan_enum,
  "papan_tulis" kondisi_kebersihan_enum,
  "jendela_pintu" kondisi_kebersihan_enum,
  "sampah" kondisi_kebersihan_enum,
  "catatan" text,
  "foto_url" text,
  "dinilai_oleh" uuid
);

CREATE TABLE "refleksi_wali_kelas" (
  "id" serial PRIMARY KEY,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "capaian" text,
  "tantangan" text,
  "rencana" text,
  "dibuat_oleh" uuid
);

CREATE TABLE "pemanggilan_ortu" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "orang_tua_id" int,
  "nomor_surat" varchar(60) UNIQUE,
  "tanggal_surat" date,
  "tanggal_panggilan" date NOT NULL,
  "jam" time,
  "tempat" varchar(100),
  "kategori" kategori_bk_enum NOT NULL,
  "alasan" text NOT NULL,
  "status" status_panggilan_enum NOT NULL DEFAULT 'dijadwalkan',
  "hasil_pertemuan" text,
  "kesepakatan" text,
  "tindak_lanjut" text,
  "dibuat_oleh" uuid NOT NULL
);

CREATE TABLE "pendampingan_ortu" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "orang_tua_id" int,
  "jenis" jenis_pendampingan_enum NOT NULL,
  "tanggal" date NOT NULL,
  "sesi_ke" smallint,
  "topik" varchar(200) NOT NULL,
  "permasalahan" text,
  "uraian_kegiatan" text,
  "hasil" text,
  "rencana_tindak_lanjut" text,
  "status" status_pendampingan_enum NOT NULL DEFAULT 'masih_berjalan',
  "dibuat_oleh" uuid NOT NULL
);

CREATE TABLE "pengembalian_siswa" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "orang_tua_id" int,
  "nomor_surat" varchar(60) UNIQUE,
  "tanggal_pengajuan" date NOT NULL,
  "jenis" jenis_pengembalian_enum NOT NULL,
  "tanggal_mulai" date,
  "tanggal_sampai" date,
  "alasan" text NOT NULL,
  "dasar_pertimbangan" text,
  "status" status_pengembalian_enum NOT NULL DEFAULT 'diajukan',
  "diajukan_oleh" uuid NOT NULL,
  "diputuskan_oleh" uuid,
  "tanggal_keputusan" timestamp,
  "catatan_keputusan" text
);

CREATE TABLE "lampiran_bk" (
  "id" serial PRIMARY KEY,
  "pemanggilan_id" int,
  "pendampingan_id" int,
  "pengembalian_id" int,
  "file_path" varchar(255) NOT NULL,
  "file_mime" varchar(100),
  "diunggah_oleh" uuid,
  "diunggah_pada" timestamp NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX ON "bobot_nilai" ("pengampu_id", "semester");

CREATE UNIQUE INDEX ON "konversi_perilaku" ("pengampu_id", "predikat");

CREATE UNIQUE INDEX ON "nilai_siswa" ("siswa_id", "pengampu_id", "semester");

CREATE UNIQUE INDEX ON "penilaian_harian" ("pengampu_id", "semester", "urutan");

CREATE UNIQUE INDEX ON "nilai_harian" ("penilaian_harian_id", "siswa_id");

CREATE UNIQUE INDEX ON "absensi_siswa" ("siswa_id", "tanggal", "jadwal_id");

CREATE UNIQUE INDEX ON "presensi_harian" ("siswa_id", "tanggal");

COMMENT ON TABLE "bobot_nilai" IS 'CHECK total semua bobot = 100. Dipindah dari setiap baris nilai_siswa';

COMMENT ON COLUMN "konversi_perilaku"."nilai_angka" IS 'diisi guru 0-100';

COMMENT ON TABLE "nilai_siswa" IS 'bobot_* dipindah ke bobot_nilai; nilai_akhir dihitung di VIEW v_nilai_akhir';

COMMENT ON COLUMN "nilai_siswa"."pengampu_id" IS 'menggantikan kelas_id, mapel_id, guru_id, tahun_ajar';

COMMENT ON COLUMN "nilai_siswa"."tugas" IS 'NULL = belum ada nilai (bukan 0)';

COMMENT ON COLUMN "penilaian_harian"."urutan" IS 'P1, P2, dst';

COMMENT ON COLUMN "nilai_harian"."nilai" IS 'NULL jika siswa tidak ikut';

COMMENT ON COLUMN "absensi_siswa"."jadwal_id" IS 'kelas, mapel, guru, tahun ajaran diturunkan dari jadwal';

COMMENT ON TABLE "presensi_harian" IS 'Presensi harian wali kelas (dulu absensi_siswa dengan jadwal_id NULL)';

COMMENT ON TABLE "kebersihan_kelas" IS 'JSONB penilaian diganti 5 kolom aspek';

COMMENT ON TABLE "pemanggilan_ortu" IS 'Menggantikan surat_panggilan_siswa';

COMMENT ON COLUMN "pemanggilan_ortu"."dibuat_oleh" IS 'akun BK atau wali kelas';

COMMENT ON COLUMN "pengembalian_siswa"."tanggal_sampai" IS 'NULL jika permanen';

COMMENT ON COLUMN "pengembalian_siswa"."diputuskan_oleh" IS 'akun kepala-sekolah';

COMMENT ON TABLE "lampiran_bk" IS 'CHECK num_nonnulls(pemanggilan_id, pendampingan_id, pengembalian_id) = 1';

COMMENT ON COLUMN "lampiran_bk"."file_path" IS 'PDF/JPG/PNG maks 5 MB';
