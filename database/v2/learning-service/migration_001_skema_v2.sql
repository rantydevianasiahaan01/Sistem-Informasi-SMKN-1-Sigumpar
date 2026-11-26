-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : learning-service (absensi guru, perangkat pembelajaran, evaluasi guru)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "absensi_guru" (
  "id" serial PRIMARY KEY,
  "guru_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "jam_masuk" timestamptz,
  "jam_keluar" timestamptz,
  "foto" text,
  "foto_pulang" text,
  "status" status_hadir_enum NOT NULL DEFAULT 'hadir',
  "keterangan" text
);

CREATE TABLE "catatan_mengajar" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "jam_mulai" time,
  "jam_selesai" time,
  "materi" text NOT NULL,
  "metode" text,
  "kendala" text,
  "tindak_lanjut" text
);

CREATE TABLE "perangkat_pembelajaran" (
  "id" serial PRIMARY KEY,
  "guru_id" int NOT NULL,
  "mapel_id" int,
  "nama_dokumen" varchar(200) NOT NULL,
  "jenis_dokumen" varchar(50) NOT NULL,
  "file_name" varchar(255),
  "file_path" varchar(255),
  "file_mime" varchar(100),
  "versi" int NOT NULL DEFAULT 1,
  "parent_id" int,
  "tanggal_upload" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "review_perangkat" (
  "id" serial PRIMARY KEY,
  "perangkat_id" int NOT NULL,
  "reviewer_user_id" uuid NOT NULL,
  "peran_reviewer" peran_reviewer_enum NOT NULL,
  "status" status_review_enum NOT NULL,
  "komentar" text,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "evaluasi_guru" (
  "id" serial PRIMARY KEY,
  "guru_id" int NOT NULL,
  "tahun_ajaran_id" int NOT NULL,
  "semester" semester_enum NOT NULL,
  "evaluator_user_id" uuid NOT NULL,
  "perencanaan" numeric(5,2),
  "pelaksanaan" numeric(5,2),
  "penilaian" numeric(5,2),
  "pengembangan" numeric(5,2),
  "kedisiplinan" numeric(5,2),
  "catatan" text,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX ON "absensi_guru" ("guru_id", "tanggal");

COMMENT ON COLUMN "absensi_guru"."guru_id" IS 'per orang, bukan per akun; menggantikan user_id + nama_guru';

COMMENT ON TABLE "perangkat_pembelajaran" IS 'status_review dihapus; status terkini = review terakhir di review_perangkat';

COMMENT ON COLUMN "perangkat_pembelajaran"."jenis_dokumen" IS 'RPP, silabus, modul, lainnya';

COMMENT ON COLUMN "perangkat_pembelajaran"."parent_id" IS 'versi sebelumnya';

COMMENT ON TABLE "review_perangkat" IS 'Menggabungkan review_kepsek dan review_wakasek (struktur sama)';

COMMENT ON TABLE "evaluasi_guru" IS 'JSONB penilaian diganti 5 kolom aspek. skor & predikat dihitung di VIEW v_evaluasi_guru';

COMMENT ON COLUMN "evaluasi_guru"."perencanaan" IS 'bobot 20%';

COMMENT ON COLUMN "evaluasi_guru"."pelaksanaan" IS 'bobot 30%';

COMMENT ON COLUMN "evaluasi_guru"."penilaian" IS 'bobot 20%';

COMMENT ON COLUMN "evaluasi_guru"."pengembangan" IS 'bobot 15%';

COMMENT ON COLUMN "evaluasi_guru"."kedisiplinan" IS 'bobot 15%';
