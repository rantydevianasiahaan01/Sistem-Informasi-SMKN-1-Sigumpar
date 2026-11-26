-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : academic-service (master akademik, jadwal, tata usaha, arsip surat)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "tahun_ajaran" (
  "id" serial PRIMARY KEY,
  "label" varchar(20) UNIQUE NOT NULL,
  "tanggal_mulai" date,
  "tanggal_selesai" date,
  "is_active" boolean NOT NULL DEFAULT false
);

CREATE TABLE "guru" (
  "id" serial PRIMARY KEY,
  "nip" varchar(30) UNIQUE,
  "nama_lengkap" varchar(150) NOT NULL,
  "email" varchar(150),
  "no_telepon" varchar(20),
  "jabatan" varchar(100),
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "kelas" (
  "id" serial PRIMARY KEY,
  "nama_kelas" varchar(50) NOT NULL,
  "tingkat" varchar(10) NOT NULL,
  "jurusan" varchar(100)
);

CREATE TABLE "kelas_tahun_ajaran" (
  "id" serial PRIMARY KEY,
  "kelas_id" int NOT NULL,
  "tahun_ajaran_id" int NOT NULL,
  "wali_kelas_guru_id" int
);

CREATE TABLE "siswa" (
  "id" serial PRIMARY KEY,
  "nisn" varchar(20) UNIQUE NOT NULL,
  "nama_lengkap" varchar(150) NOT NULL,
  "jenis_kelamin" char(1),
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "siswa_kelas_tahun_ajaran" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "status" status_rombel_enum NOT NULL DEFAULT 'aktif'
);

CREATE TABLE "orang_tua" (
  "id" serial PRIMARY KEY,
  "siswa_id" int NOT NULL,
  "nama" varchar(150) NOT NULL,
  "hubungan" hubungan_enum NOT NULL,
  "no_hp" varchar(20)
);

CREATE TABLE "mata_pelajaran" (
  "id" serial PRIMARY KEY,
  "kode" varchar(20) UNIQUE,
  "nama_mapel" varchar(100) NOT NULL,
  "kkm" smallint NOT NULL DEFAULT 75
);

CREATE TABLE "pengampu" (
  "id" serial PRIMARY KEY,
  "mapel_id" int NOT NULL,
  "kelas_tahun_ajaran_id" int NOT NULL,
  "guru_id" int NOT NULL
);

CREATE TABLE "jadwal_mengajar" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "hari" hari_enum NOT NULL,
  "jam_ke" smallint,
  "ruang" varchar(50),
  "waktu_mulai" time NOT NULL,
  "waktu_berakhir" time NOT NULL
);

CREATE TABLE "jadwal_piket" (
  "id" serial PRIMARY KEY,
  "tahun_ajaran_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "guru_id" int NOT NULL,
  "keterangan" text,
  "dibuat_oleh" uuid
);

CREATE TABLE "jadwal_upacara" (
  "id" serial PRIMARY KEY,
  "tanggal" date NOT NULL,
  "petugas_guru_id" int,
  "tugas" varchar(150) NOT NULL,
  "keterangan" text,
  "dibuat_oleh" uuid NOT NULL
);

CREATE TABLE "pengumuman" (
  "id" serial PRIMARY KEY,
  "judul" varchar(255) NOT NULL,
  "isi" text,
  "tanggal_berakhir" timestamp,
  "dibuat_oleh" uuid,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "arsip_surat" (
  "id" serial PRIMARY KEY,
  "nomor_surat" varchar(100) UNIQUE NOT NULL,
  "judul" varchar(255) NOT NULL,
  "kategori" varchar(100),
  "tanggal_surat" date NOT NULL,
  "file_url" text NOT NULL,
  "file_name" varchar(255),
  "file_mime" varchar(100),
  "menggantikan_id" int,
  "diunggah_oleh" uuid,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "supervisi_guru" (
  "id" serial PRIMARY KEY,
  "pengampu_id" int NOT NULL,
  "tanggal" date NOT NULL,
  "aspek_penilaian" varchar(150),
  "nilai" numeric(5,2),
  "catatan" text,
  "rekomendasi" text,
  "supervisor_user_id" uuid
);

CREATE TABLE "program_kerja" (
  "id" serial PRIMARY KEY,
  "tahun_ajaran_id" int NOT NULL,
  "nama_program" varchar(200) NOT NULL,
  "bidang" varchar(100),
  "tanggal_mulai" date,
  "tanggal_selesai" date,
  "penanggung_jawab_guru_id" int,
  "status" status_program_enum NOT NULL DEFAULT 'belum_mulai',
  "deskripsi" text
);

CREATE TABLE "perangkat_guru" (
  "id" serial PRIMARY KEY,
  "guru_id" int NOT NULL,
  "tahun_ajaran_id" int NOT NULL,
  "nama_perangkat" varchar(200) NOT NULL,
  "jenis" varchar(100),
  "status" varchar(30) NOT NULL DEFAULT 'belum_lengkap',
  "catatan" text
);

CREATE UNIQUE INDEX ON "kelas_tahun_ajaran" ("kelas_id", "tahun_ajaran_id");

CREATE UNIQUE INDEX ON "siswa_kelas_tahun_ajaran" ("siswa_id", "kelas_tahun_ajaran_id");

CREATE UNIQUE INDEX ON "pengampu" ("mapel_id", "kelas_tahun_ajaran_id");

COMMENT ON COLUMN "tahun_ajaran"."label" IS 'contoh 2026/2027';

COMMENT ON COLUMN "tahun_ajaran"."is_active" IS 'hanya satu baris true (partial unique index)';

COMMENT ON COLUMN "kelas"."nama_kelas" IS 'contoh XI RPL 1';

COMMENT ON COLUMN "kelas"."tingkat" IS 'X, XI, XII';

COMMENT ON TABLE "kelas_tahun_ajaran" IS 'Rombel: kelas pada tahun ajaran tertentu';

COMMENT ON COLUMN "kelas_tahun_ajaran"."wali_kelas_guru_id" IS 'menggantikan wali_kelas_id UUID + wali_kelas_nama';

COMMENT ON TABLE "siswa" IS 'kelas_id dihapus: kelas siswa ditentukan lewat siswa_kelas_tahun_ajaran';

COMMENT ON COLUMN "siswa"."jenis_kelamin" IS 'L / P';

COMMENT ON TABLE "mata_pelajaran" IS 'kelas_id dan guru_mapel_id dipindah ke tabel pengampu';

COMMENT ON TABLE "pengampu" IS 'Guru X mengajar mapel Y di rombel Z. Dipakai nilai, jadwal, catatan mengajar';

COMMENT ON TABLE "jadwal_mengajar" IS 'guru, kelas, mapel diambil dari pengampu (tidak disalin)';

COMMENT ON TABLE "jadwal_upacara" IS 'Hanya dikelola Tata Usaha; role lain read-only';

COMMENT ON COLUMN "jadwal_upacara"."dibuat_oleh" IS 'hanya akun role tata-usaha';

COMMENT ON TABLE "arsip_surat" IS 'READ-ONLY: setelah disimpan tidak bisa UPDATE/DELETE (trigger). Revisi = baris baru.';

COMMENT ON COLUMN "arsip_surat"."menggantikan_id" IS 'jika arsip direvisi, baris baru menunjuk ke arsip lama';

COMMENT ON COLUMN "supervisi_guru"."pengampu_id" IS 'menggantikan guru_id + kelas + mata_pelajaran teks';

COMMENT ON COLUMN "program_kerja"."penanggung_jawab_guru_id" IS 'menggantikan penanggung_jawab teks';

COMMENT ON TABLE "perangkat_guru" IS 'Ceklist kelengkapan perangkat oleh Waka';
