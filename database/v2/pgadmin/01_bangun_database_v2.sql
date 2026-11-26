-- =====================================================================
-- SEMUA DALAM SATU FILE (untuk pgAdmin)
-- Isi: migration 000, 001-003 semua service, seed wajib, dan seed DEMO.
-- Dibuat otomatis dari file di database/v2 (urutan sama dengan jalankan_semua.sh).
--
-- Cara pakai: buat database kosong "pkm_v2" -> klik kanan -> Query Tool ->
-- buka file ini -> tekan F5 (Execute). Hanya untuk database KOSONG.
-- JANGAN jalankan di database tim (pkm_smkn1sigumpar).
-- Password semua akun demo: Sigumpar#2026
-- =====================================================================
SET client_min_messages = warning;


-- >>>>> 000-umum/migration_000_ekstensi_enum.sql
-- =====================================================================
-- MIGRATION 000: Ekstensi, tipe ENUM, dan fungsi bersama
-- Dijalankan PALING AWAL karena dipakai tabel dari beberapa service
-- (semua service memakai satu database PostgreSQL yang sama).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE TYPE "semester_enum" AS ENUM (
  'ganjil',
  'genap'
);

CREATE TYPE "status_hadir_enum" AS ENUM (
  'hadir',
  'izin',
  'sakit',
  'alpa',
  'terlambat'
);

CREATE TYPE "hari_enum" AS ENUM (
  'senin',
  'selasa',
  'rabu',
  'kamis',
  'jumat',
  'sabtu'
);

CREATE TYPE "status_rombel_enum" AS ENUM (
  'aktif',
  'pindah',
  'dikembalikan',
  'lulus',
  'keluar'
);

CREATE TYPE "hubungan_enum" AS ENUM (
  'ayah',
  'ibu',
  'wali'
);

CREATE TYPE "predikat_perilaku_enum" AS ENUM (
  'A',
  'B',
  'C',
  'D',
  'E'
);

CREATE TYPE "jenis_harian_enum" AS ENUM (
  'kuis',
  'tugas_harian',
  'ulangan_harian',
  'lisan',
  'lainnya'
);

CREATE TYPE "status_review_enum" AS ENUM (
  'disetujui',
  'revisi',
  'ditolak'
);

CREATE TYPE "peran_reviewer_enum" AS ENUM (
  'kepala_sekolah',
  'waka_sekolah'
);

CREATE TYPE "kondisi_kebersihan_enum" AS ENUM (
  'sangat_bersih',
  'bersih',
  'cukup',
  'kotor'
);

CREATE TYPE "status_program_enum" AS ENUM (
  'belum_mulai',
  'berjalan',
  'selesai',
  'batal'
);

CREATE TYPE "status_penempatan_enum" AS ENUM (
  'aktif',
  'dipindahkan',
  'selesai'
);

CREATE TYPE "penyetuju_pindah_enum" AS ENUM (
  'koordinator_pkl',
  'waka_humas',
  'kepala_sekolah'
);

CREATE TYPE "kategori_bk_enum" AS ENUM (
  'akademik',
  'kedisiplinan',
  'kehadiran',
  'perilaku',
  'lainnya'
);

CREATE TYPE "status_panggilan_enum" AS ENUM (
  'dijadwalkan',
  'hadir',
  'tidak_hadir',
  'dijadwal_ulang',
  'selesai'
);

CREATE TYPE "jenis_pendampingan_enum" AS ENUM (
  'pendampingan',
  'pembinaan'
);

CREATE TYPE "status_pendampingan_enum" AS ENUM (
  'masih_berjalan',
  'selesai'
);

CREATE TYPE "jenis_pengembalian_enum" AS ENUM (
  'sementara',
  'permanen'
);

CREATE TYPE "status_pengembalian_enum" AS ENUM (
  'diajukan',
  'disetujui',
  'ditolak',
  'selesai'
);

CREATE TYPE "status_respon_enum" AS ENUM (
  'menunggu',
  'disetujui',
  'ditolak'
);

CREATE TYPE "peran_responden_enum" AS ENUM (
  'bendahara',
  'kepala_sekolah'
);

-- Dipakai trigger read-only / append-only di beberapa service
CREATE OR REPLACE FUNCTION tolak_ubah_data() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat read-only: operasi % tidak diizinkan',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- Akun hanya boleh dibuat oleh akun Tata Usaha yang aktif.
-- dibuat_oleh NULL hanya diizinkan untuk akun pertama (tabel users masih kosong),
-- yaitu akun admin Tata Usaha yang dibuat auth-service dari .env.
CREATE OR REPLACE FUNCTION cek_pembuat_akun() RETURNS trigger AS $$
BEGIN
  IF NEW.dibuat_oleh IS NULL THEN
    IF EXISTS (SELECT 1 FROM users) THEN
      RAISE EXCEPTION 'Akun baru wajib mencatat pembuatnya (dibuat_oleh)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.id = NEW.dibuat_oleh AND r.nama = 'tata-usaha' AND u.is_aktif
  ) THEN
    RAISE EXCEPTION 'Hanya akun Tata Usaha yang aktif yang boleh membuat akun'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- >>>>> auth-service/migration_001_skema_v2.sql
-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : auth-service (akun, role, token, audit log)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "roles" (
  "id" serial PRIMARY KEY,
  "nama" varchar(50) UNIQUE NOT NULL,
  "label" varchar(100) NOT NULL
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "username" varchar(50) NOT NULL,
  "nama_lengkap" varchar(150) NOT NULL,
  "email" varchar(150),
  "password_hash" text NOT NULL,
  "role_id" int NOT NULL,
  "guru_id" int,
  "dibuat_oleh" uuid,
  "is_aktif" boolean NOT NULL DEFAULT true,
  "harus_ganti_password" boolean NOT NULL DEFAULT true,
  "foto_profil" varchar(255),
  "gagal_login" smallint NOT NULL DEFAULT 0,
  "terkunci_sampai" timestamptz,
  "password_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "token_hash" text UNIQUE NOT NULL,
  "user_agent" text,
  "ip" text,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "jwt_keys" (
  "kid" text PRIMARY KEY,
  "private_pem" text NOT NULL,
  "public_pem" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit_log" (
  "id" bigserial PRIMARY KEY,
  "actor_user_id" uuid,
  "actor_username" varchar(50),
  "service" varchar(30) NOT NULL,
  "aksi" varchar(60) NOT NULL,
  "entitas" varchar(60) NOT NULL,
  "entitas_id" varchar(64),
  "data_lama" jsonb,
  "data_baru" jsonb,
  "ip" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "users" ("guru_id");

CREATE UNIQUE INDEX ON "users" ("guru_id", "role_id");

CREATE INDEX ON "audit_log" ("created_at");

CREATE INDEX ON "audit_log" ("entitas", "entitas_id");

COMMENT ON COLUMN "roles"."nama" IS 'kepala-sekolah, waka-sekolah, tata-usaha, wali-kelas, guru-mapel, pramuka, vokasi, bk';

COMMENT ON COLUMN "users"."username" IS 'unik tanpa memperhatikan huruf besar/kecil: UNIQUE INDEX (LOWER(username))';

COMMENT ON COLUMN "users"."password_hash" IS 'scrypt$N$r$p$salt$hash';

COMMENT ON COLUMN "users"."role_id" IS '1 akun = 1 role; menggantikan tabel user_roles';

COMMENT ON COLUMN "users"."guru_id" IS 'orang di balik akun; null untuk staf non-guru. 1 guru boleh punya beberapa akun (1 per role)';

COMMENT ON COLUMN "users"."dibuat_oleh" IS 'akun Tata Usaha yang membuat akun ini; null hanya untuk akun admin pertama (dibuat sistem)';

COMMENT ON TABLE "audit_log" IS 'APPEND-ONLY: UPDATE dan DELETE ditolak trigger. Dipakai semua service (termasuk BK).';

COMMENT ON COLUMN "audit_log"."actor_username" IS 'snapshot saat kejadian (log historis, bukan data master)';

COMMENT ON COLUMN "audit_log"."service" IS 'auth, academic, learning, student, vocational, asset';

COMMENT ON COLUMN "audit_log"."aksi" IS 'mis. CREATE, UPDATE, DELETE, LOGIN, RESET_PASSWORD';

COMMENT ON COLUMN "audit_log"."entitas" IS 'nama tabel yang diubah';

COMMENT ON COLUMN "audit_log"."entitas_id" IS 'id baris yang diubah';

-- >>>>> academic-service/migration_001_skema_v2.sql
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

-- >>>>> learning-service/migration_001_skema_v2.sql
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

-- >>>>> student-service/migration_001_skema_v2.sql
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

-- >>>>> vocational-service/migration_001_skema_v2.sql
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

-- >>>>> asset-service/migration_001_skema_v2.sql
-- =====================================================================
-- MIGRATION 001: Tabel dan indeks (skema v2)
-- Service : asset-service (peminjaman dan pengajuan barang)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Hanya CREATE TABLE/INDEX/COMMENT. Relasi ada di 002.
-- =====================================================================

CREATE TABLE "barang" (
  "id" serial PRIMARY KEY,
  "nama_barang" varchar(150) NOT NULL,
  "kategori" varchar(100),
  "jumlah_total" int NOT NULL DEFAULT 0,
  "kondisi" varchar(50)
);

CREATE TABLE "peminjaman_barang" (
  "id" serial PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "barang_id" int NOT NULL,
  "jumlah" int NOT NULL DEFAULT 1,
  "tanggal_pinjam" date NOT NULL,
  "tanggal_kembali" date,
  "keperluan" text
);

CREATE TABLE "respon_peminjaman" (
  "id" serial PRIMARY KEY,
  "peminjaman_id" int NOT NULL,
  "status" status_respon_enum NOT NULL,
  "catatan" text,
  "direspon_oleh" uuid,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "pengajuan_alat_barang" (
  "id" serial PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "nama_alat" varchar(100) NOT NULL,
  "jumlah" int NOT NULL,
  "alasan" text,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "respon_pengajuan" (
  "id" serial PRIMARY KEY,
  "pengajuan_id" int NOT NULL,
  "peran_responden" peran_responden_enum NOT NULL,
  "status" status_respon_enum NOT NULL,
  "catatan" text,
  "direspon_oleh" uuid,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

COMMENT ON TABLE "barang" IS 'Baru: peminjaman_barang.barang_id sebelumnya tidak punya tabel induk';

COMMENT ON TABLE "respon_pengajuan" IS 'Menggabungkan respon_pengajuan_bendahara dan respon_pengajuan_kepsek';

-- >>>>> auth-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : auth-service (akun, role, token, audit log)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "users" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refresh_tokens" ADD FOREIGN KEY ("replaced_by") REFERENCES "refresh_tokens" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_log" ADD FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> academic-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : academic-service (master akademik, jadwal, tata usaha, arsip surat)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kelas_tahun_ajaran" ADD FOREIGN KEY ("wali_kelas_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "siswa_kelas_tahun_ajaran" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "siswa_kelas_tahun_ajaran" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "orang_tua" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengampu" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_mengajar" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_piket" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_upacara" ADD FOREIGN KEY ("petugas_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "jadwal_upacara" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengumuman" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "arsip_surat" ADD FOREIGN KEY ("menggantikan_id") REFERENCES "arsip_surat" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "arsip_surat" ADD FOREIGN KEY ("diunggah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "supervisi_guru" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "supervisi_guru" ADD FOREIGN KEY ("supervisor_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "program_kerja" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "program_kerja" ADD FOREIGN KEY ("penanggung_jawab_guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_guru" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_guru" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> learning-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : learning-service (absensi guru, perangkat pembelajaran, evaluasi guru)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "absensi_guru" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "catatan_mengajar" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_pembelajaran" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_pembelajaran" ADD FOREIGN KEY ("mapel_id") REFERENCES "mata_pelajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perangkat_pembelajaran" ADD FOREIGN KEY ("parent_id") REFERENCES "perangkat_pembelajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "review_perangkat" ADD FOREIGN KEY ("perangkat_id") REFERENCES "perangkat_pembelajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "review_perangkat" ADD FOREIGN KEY ("reviewer_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluasi_guru" ADD FOREIGN KEY ("guru_id") REFERENCES "guru" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluasi_guru" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "evaluasi_guru" ADD FOREIGN KEY ("evaluator_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> student-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : student-service (nilai, wali kelas, BK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "bobot_nilai" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "konversi_perilaku" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_siswa" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "riwayat_nilai" ADD FOREIGN KEY ("nilai_id") REFERENCES "nilai_siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "riwayat_nilai" ADD FOREIGN KEY ("diubah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penilaian_harian" ADD FOREIGN KEY ("pengampu_id") REFERENCES "pengampu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_harian" ADD FOREIGN KEY ("penilaian_harian_id") REFERENCES "penilaian_harian" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_harian" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("jadwal_id") REFERENCES "jadwal_mengajar" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_siswa" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "presensi_harian" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "presensi_harian" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "catatan_parenting" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "catatan_parenting" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kebersihan_kelas" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kebersihan_kelas" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refleksi_wali_kelas" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "refleksi_wali_kelas" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pemanggilan_ortu" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pendampingan_ortu" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("orang_tua_id") REFERENCES "orang_tua" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("diajukan_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengembalian_siswa" ADD FOREIGN KEY ("diputuskan_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pemanggilan_id") REFERENCES "pemanggilan_ortu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pendampingan_id") REFERENCES "pendampingan_ortu" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("pengembalian_id") REFERENCES "pengembalian_siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lampiran_bk" ADD FOREIGN KEY ("diunggah_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> vocational-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : vocational-service (Pramuka, PKL, UKK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "kelas_pramuka" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "anggota_regu" ADD FOREIGN KEY ("regu_id") REFERENCES "kelas_pramuka" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "anggota_regu" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kegiatan_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "kegiatan_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_pramuka" ADD FOREIGN KEY ("kegiatan_id") REFERENCES "kegiatan_pramuka" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "absensi_pramuka" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "silabus_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "silabus_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_pramuka" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_pramuka" ADD FOREIGN KEY ("dibuat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("perusahaan_id") REFERENCES "perusahaan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "penempatan_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("penempatan_asal_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("penempatan_tujuan_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "perpindahan_pkl" ADD FOREIGN KEY ("dicatat_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "koreksi_perpindahan" ADD FOREIGN KEY ("perpindahan_id") REFERENCES "perpindahan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "koreksi_perpindahan" ADD FOREIGN KEY ("dikoreksi_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "laporan_progres_pkl" ADD FOREIGN KEY ("penempatan_id") REFERENCES "penempatan_pkl" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_pkl" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_ukk" ADD FOREIGN KEY ("tahun_ajaran_id") REFERENCES "tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengaturan_ukk" ADD FOREIGN KEY ("updated_by") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "soal_ukk" ADD FOREIGN KEY ("kelas_tahun_ajaran_id") REFERENCES "kelas_tahun_ajaran" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "progres_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "progres_ukk" ADD FOREIGN KEY ("soal_id") REFERENCES "soal_ukk" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("soal_id") REFERENCES "soal_ukk" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "nilai_ukk" ADD FOREIGN KEY ("dinilai_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sertifikat_ukk" ADD FOREIGN KEY ("siswa_id") REFERENCES "siswa" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> asset-service/migration_002_relasi_v2.sql
-- =====================================================================
-- MIGRATION 002: Foreign key (skema v2)
-- Service : asset-service (peminjaman dan pengajuan barang)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 001 SEMUA service, karena ada FK lintas service.
-- =====================================================================

ALTER TABLE "peminjaman_barang" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "peminjaman_barang" ADD FOREIGN KEY ("barang_id") REFERENCES "barang" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "respon_peminjaman" ADD FOREIGN KEY ("peminjaman_id") REFERENCES "peminjaman_barang" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "respon_peminjaman" ADD FOREIGN KEY ("direspon_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pengajuan_alat_barang" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "respon_pengajuan" ADD FOREIGN KEY ("pengajuan_id") REFERENCES "pengajuan_alat_barang" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "respon_pengajuan" ADD FOREIGN KEY ("direspon_oleh") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

-- >>>>> auth-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : auth-service (akun, role, token, audit log)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

-- Username unik tanpa memperhatikan huruf besar/kecil (sama dengan repo saat ini)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- Audit log: append-only
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;

CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

DROP TRIGGER IF EXISTS trg_users_dibuat_tu ON users;

CREATE TRIGGER trg_users_dibuat_tu
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION cek_pembuat_akun();

-- >>>>> academic-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : academic-service (master akademik, jadwal, tata usaha, arsip surat)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

-- Hanya satu tahun ajaran yang boleh aktif
CREATE UNIQUE INDEX IF NOT EXISTS idx_tahun_ajaran_satu_aktif
  ON tahun_ajaran (is_active) WHERE is_active = true;

-- Arsip surat: hanya INSERT dan SELECT. Revisi = baris baru dengan menggantikan_id.
DROP TRIGGER IF EXISTS trg_arsip_surat_read_only ON arsip_surat;

CREATE TRIGGER trg_arsip_surat_read_only
  BEFORE UPDATE OR DELETE ON arsip_surat
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

-- >>>>> learning-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : learning-service (absensi guru, perangkat pembelajaran, evaluasi guru)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE evaluasi_guru ADD CONSTRAINT ck_evaluasi_rentang CHECK (
  (perencanaan  IS NULL OR perencanaan  BETWEEN 0 AND 100) AND
  (pelaksanaan  IS NULL OR pelaksanaan  BETWEEN 0 AND 100) AND
  (penilaian    IS NULL OR penilaian    BETWEEN 0 AND 100) AND
  (pengembangan IS NULL OR pengembangan BETWEEN 0 AND 100) AND
  (kedisiplinan IS NULL OR kedisiplinan BETWEEN 0 AND 100)
);

-- 4d. Skor evaluasi kinerja guru (bobot 20/30/20/15/15 sesuai user manual)
CREATE OR REPLACE VIEW v_evaluasi_guru AS
SELECT e.*,
  ROUND(e.perencanaan * 0.20 + e.pelaksanaan * 0.30 + e.penilaian * 0.20
      + e.pengembangan * 0.15 + e.kedisiplinan * 0.15, 2) AS skor
FROM evaluasi_guru e;

-- 4e. Status review terkini perangkat pembelajaran
CREATE OR REPLACE VIEW v_status_perangkat AS
SELECT p.*,
  COALESCE(r.status::text, 'menunggu') AS status_review,
  r.komentar        AS catatan_review,
  r.peran_reviewer  AS direview_oleh_peran,
  r.created_at      AS direview_pada
FROM perangkat_pembelajaran p
LEFT JOIN LATERAL (
  SELECT * FROM review_perangkat rp
  WHERE rp.perangkat_id = p.id
  ORDER BY rp.created_at DESC
  LIMIT 1
) r ON true;

-- >>>>> student-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : student-service (nilai, wali kelas, BK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE bobot_nilai ADD CONSTRAINT ck_bobot_nilai_total CHECK (
  bobot_harian + bobot_tugas + bobot_kuis + bobot_uts + bobot_uas + bobot_praktik + bobot_perilaku = 100
);

ALTER TABLE nilai_siswa ADD CONSTRAINT ck_nilai_siswa_rentang CHECK (
  (tugas   IS NULL OR tugas   BETWEEN 0 AND 100) AND
  (kuis    IS NULL OR kuis    BETWEEN 0 AND 100) AND
  (uts     IS NULL OR uts     BETWEEN 0 AND 100) AND
  (uas     IS NULL OR uas     BETWEEN 0 AND 100) AND
  (praktik IS NULL OR praktik BETWEEN 0 AND 100)
);

ALTER TABLE nilai_harian ADD CONSTRAINT ck_nilai_harian_rentang
  CHECK (nilai IS NULL OR nilai BETWEEN 0 AND 100);

ALTER TABLE konversi_perilaku ADD CONSTRAINT ck_konversi_rentang
  CHECK (nilai_angka BETWEEN 0 AND 100);

-- Pengembalian sementara wajib punya periode; permanen tidak punya tanggal_sampai
ALTER TABLE pengembalian_siswa ADD CONSTRAINT ck_pengembalian_periode CHECK (
  (jenis = 'sementara' AND tanggal_mulai IS NOT NULL AND tanggal_sampai IS NOT NULL
     AND tanggal_sampai >= tanggal_mulai)
  OR (jenis = 'permanen' AND tanggal_sampai IS NULL)
);

-- Lampiran BK hanya milik tepat satu catatan BK
ALTER TABLE lampiran_bk ADD CONSTRAINT ck_lampiran_bk_satu_induk
  CHECK (num_nonnulls(pemanggilan_id, pendampingan_id, pengembalian_id) = 1);

-- Lapis kedua (opsional, sesuaikan nama user DB tiap service):
-- REVOKE UPDATE, DELETE, TRUNCATE ON arsip_surat FROM academic_user;
-- REVOKE UPDATE, DELETE, TRUNCATE ON audit_log  FROM auth_user;


-- 4a. Nilai akhir mapel.
-- Aturan: komponen yang NULL tidak dihitung dan bobotnya dibagi proporsional.
-- Harian = rata-rata nilai_harian yang diikuti siswa (NULL jika tidak ada penilaian harian).
-- Perilaku hanya dihitung jika konversi A-E untuk pengampu itu sudah lengkap (5 baris).
CREATE OR REPLACE VIEW v_nilai_akhir AS
WITH harian AS (
  SELECT ph.pengampu_id, ph.semester, nh.siswa_id,
         AVG(nh.nilai)   AS rata_harian,
         COUNT(nh.nilai) AS jumlah_harian_diikuti
  FROM penilaian_harian ph
  JOIN nilai_harian nh ON nh.penilaian_harian_id = ph.id
  GROUP BY ph.pengampu_id, ph.semester, nh.siswa_id
),
konversi_lengkap AS (
  SELECT pengampu_id FROM konversi_perilaku
  GROUP BY pengampu_id HAVING COUNT(*) = 5
),
dasar AS (
  SELECT n.id AS nilai_id, n.siswa_id, n.pengampu_id, n.semester,
         h.rata_harian, h.jumlah_harian_diikuti,
         n.tugas, n.kuis, n.uts, n.uas, n.praktik,
         n.predikat_perilaku,
         CASE WHEN kl.pengampu_id IS NOT NULL THEN kp.nilai_angka END AS nilai_perilaku,
         b.bobot_harian, b.bobot_tugas, b.bobot_kuis, b.bobot_uts,
         b.bobot_uas, b.bobot_praktik, b.bobot_perilaku
  FROM nilai_siswa n
  JOIN bobot_nilai b
    ON b.pengampu_id = n.pengampu_id AND b.semester = n.semester
  LEFT JOIN harian h
    ON h.pengampu_id = n.pengampu_id AND h.semester = n.semester AND h.siswa_id = n.siswa_id
  LEFT JOIN konversi_perilaku kp
    ON kp.pengampu_id = n.pengampu_id AND kp.predikat = n.predikat_perilaku
  LEFT JOIN konversi_lengkap kl
    ON kl.pengampu_id = n.pengampu_id
)
SELECT d.*,
  ROUND(
    ( COALESCE(d.bobot_harian   * d.rata_harian, 0)
    + COALESCE(d.bobot_tugas    * d.tugas, 0)
    + COALESCE(d.bobot_kuis     * d.kuis, 0)
    + COALESCE(d.bobot_uts      * d.uts, 0)
    + COALESCE(d.bobot_uas      * d.uas, 0)
    + COALESCE(d.bobot_praktik  * d.praktik, 0)
    + COALESCE(d.bobot_perilaku * d.nilai_perilaku, 0) )
    / NULLIF(
        CASE WHEN d.rata_harian    IS NOT NULL THEN d.bobot_harian   ELSE 0 END
      + CASE WHEN d.tugas          IS NOT NULL THEN d.bobot_tugas    ELSE 0 END
      + CASE WHEN d.kuis           IS NOT NULL THEN d.bobot_kuis     ELSE 0 END
      + CASE WHEN d.uts            IS NOT NULL THEN d.bobot_uts      ELSE 0 END
      + CASE WHEN d.uas            IS NOT NULL THEN d.bobot_uas      ELSE 0 END
      + CASE WHEN d.praktik        IS NOT NULL THEN d.bobot_praktik  ELSE 0 END
      + CASE WHEN d.nilai_perilaku IS NOT NULL THEN d.bobot_perilaku ELSE 0 END
      , 0)
  , 2) AS nilai_akhir
FROM dasar d;

-- >>>>> vocational-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : vocational-service (Pramuka, PKL, UKK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE pengaturan_pkl ADD CONSTRAINT ck_pengaturan_pkl_total
  CHECK (bobot_praktik + bobot_sikap + bobot_laporan = 100);

ALTER TABLE pengaturan_ukk ADD CONSTRAINT ck_pengaturan_ukk_total
  CHECK (bobot_praktik + bobot_sikap = 100);

-- Perpindahan PKL: lokasi asal dan tujuan tidak boleh sama
ALTER TABLE perpindahan_pkl ADD CONSTRAINT ck_perpindahan_beda_lokasi
  CHECK (penempatan_asal_id <> penempatan_tujuan_id);

-- Perpindahan PKL: permanen, perbaikan lewat koreksi_perpindahan
DROP TRIGGER IF EXISTS trg_perpindahan_pkl_permanen ON perpindahan_pkl;

CREATE TRIGGER trg_perpindahan_pkl_permanen
  BEFORE UPDATE OR DELETE ON perpindahan_pkl
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

-- 4b. Nilai akhir PKL (ambang predikat = asumsi, sesuaikan dengan aturan sekolah)
CREATE OR REPLACE VIEW v_nilai_pkl AS
SELECT n.*,
  ROUND((n.nilai_praktik * p.bobot_praktik
       + n.nilai_sikap   * p.bobot_sikap
       + n.nilai_laporan * p.bobot_laporan) / 100, 2) AS nilai_akhir,
  CASE
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 90 THEN 'A'
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 80 THEN 'B'
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 70 THEN 'C'
    ELSE 'D'
  END AS predikat
FROM nilai_pkl n
JOIN pengaturan_pkl p ON p.tahun_ajaran_id = n.tahun_ajaran_id;

-- 4c. Nilai akhir UKK (bobot dari pengaturan_ukk tahun ajaran rombel soal)
CREATE OR REPLACE VIEW v_nilai_ukk AS
SELECT n.*,
  ROUND((n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap) / 100, 2) AS nilai_akhir
FROM nilai_ukk n
JOIN soal_ukk s            ON s.id = n.soal_id
JOIN kelas_tahun_ajaran kt ON kt.id = s.kelas_tahun_ajaran_id
JOIN pengaturan_ukk p      ON p.tahun_ajaran_id = kt.tahun_ajaran_id;

-- >>>>> asset-service/migration_003_aturan_v2.sql
-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : asset-service (peminjaman dan pengajuan barang)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

-- Tidak ada aturan tambahan untuk service ini.

-- >>>>> seed/seed_001_data_awal.sql
-- =====================================================================
-- SEED 001: Data awal WAJIB (boleh dipakai di server sekolah)
-- Isi   : daftar role, tahun ajaran aktif, pengaturan bobot UKK
-- Aman dijalankan berulang (ON CONFLICT / NOT EXISTS).
--
-- Akun pertama Tata Usaha TIDAK dibuat di sini. Akun itu tetap dibuat
-- auth-service saat start (src/config/seed.js) dari ADMIN_AWAL_* di .env,
-- supaya password asli tidak pernah tersimpan di repo.
-- =====================================================================

-- 1. Role. Aturan v2: 1 akun = 1 role (users.role_id).
INSERT INTO roles (nama, label) VALUES
    ('kepala-sekolah', 'Kepala Sekolah'),
    ('waka-sekolah',   'Wakil Kepala Sekolah'),
    ('tata-usaha',     'Tata Usaha'),
    ('wali-kelas',     'Wali Kelas'),
    ('guru-mapel',     'Guru Mata Pelajaran'),
    ('pramuka',        'Pembina Pramuka'),
    ('vokasi',         'Vokasi'),
    ('bk',             'Bimbingan Konseling')
ON CONFLICT (nama) DO NOTHING;

-- 2. Tahun ajaran aktif. Indeks idx_tahun_ajaran_satu_aktif menjamin hanya
--    satu yang aktif; ganti tahun ajaran = nonaktifkan yang lama dulu.
INSERT INTO tahun_ajaran (label, tanggal_mulai, tanggal_selesai, is_active)
SELECT '2026/2027', DATE '2026-07-13', DATE '2027-06-30', TRUE
WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran WHERE is_active);

-- 3. Bobot UKK default (70/30, sama dengan migration_005_bobot_ukk di repo)
INSERT INTO pengaturan_ukk (tahun_ajaran_id, bobot_praktik, bobot_sikap)
SELECT id, 70, 30 FROM tahun_ajaran WHERE is_active
ON CONFLICT (tahun_ajaran_id) DO NOTHING;

-- Bobot PKL (pengaturan_pkl) sengaja belum diisi: nilainya masih menunggu
-- keputusan sekolah. Isi lewat halaman Pengaturan PKL atau tambahkan di sini.

-- >>>>> seed/seed_002_data_demo.sql
-- =====================================================================
-- SEED 002: Data DEMO, hanya untuk laptop developer dan pengujian
-- JANGAN dijalankan di server sekolah: semua akun memakai password yang
-- sama dan tertulis di repo.
--
-- Password semua akun demo : Sigumpar#2026
-- (hash scrypt dengan format yang sama seperti src/services/sandi.js)
--
-- Isi:
--   - 6 guru, 1 kelas (X TKJ 1), 3 siswa, 1 mapel + pengampu, bobot nilai default
--   - 8 akun, satu untuk setiap role
--   - Guru "Hotman Pardede" punya DUA akun (guru-mapel dan wali-kelas)
--     untuk menunjukkan aturan 1 akun = 1 role.
-- Aman dijalankan berulang.
-- =====================================================================

-- 1. Guru
INSERT INTO guru (nip, nama_lengkap, email, jabatan) VALUES
    ('DEMO-0001', 'Mangatas Simanjuntak', 'kepsek@demo.local',  'Kepala Sekolah'),
    ('DEMO-0002', 'Rosmaida Sitorus',     'waka@demo.local',    'Wakil Kepala Sekolah'),
    ('DEMO-0003', 'Hotman Pardede',       'hotman@demo.local',  'Guru Informatika'),
    ('DEMO-0004', 'Lestari Hutapea',      'bk@demo.local',      'Guru BK'),
    ('DEMO-0005', 'Benny Silaban',        'pramuka@demo.local', 'Pembina Pramuka'),
    ('DEMO-0006', 'Juniar Manurung',      'vokasi@demo.local',  'Koordinator Vokasi')
ON CONFLICT (nip) DO NOTHING;

-- 2. Kelas dan rombel tahun ajaran aktif (wali kelas: Hotman Pardede)
INSERT INTO kelas (nama_kelas, tingkat, jurusan)
SELECT 'X TKJ 1', 'X', 'Teknik Komputer dan Jaringan'
WHERE NOT EXISTS (SELECT 1 FROM kelas WHERE nama_kelas = 'X TKJ 1');

INSERT INTO kelas_tahun_ajaran (kelas_id, tahun_ajaran_id, wali_kelas_guru_id)
SELECT k.id, ta.id, g.id
FROM kelas k, tahun_ajaran ta, guru g
WHERE k.nama_kelas = 'X TKJ 1' AND ta.is_active AND g.nip = 'DEMO-0003'
ON CONFLICT (kelas_id, tahun_ajaran_id) DO NOTHING;

-- 3. Siswa
INSERT INTO siswa (nisn, nama_lengkap, jenis_kelamin) VALUES
    ('DEMO000001', 'Andreas Sinaga',  'L'),
    ('DEMO000002', 'Debora Panjaitan', 'P'),
    ('DEMO000003', 'Yohana Situmorang', 'P')
ON CONFLICT (nisn) DO NOTHING;

INSERT INTO siswa_kelas_tahun_ajaran (siswa_id, kelas_tahun_ajaran_id)
SELECT s.id, kta.id
FROM siswa s
JOIN kelas_tahun_ajaran kta ON TRUE
JOIN kelas k ON k.id = kta.kelas_id AND k.nama_kelas = 'X TKJ 1'
JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active
WHERE s.nisn LIKE 'DEMO%'
ON CONFLICT (siswa_id, kelas_tahun_ajaran_id) DO NOTHING;

-- 4. Mapel, pengampu, dan bobot nilai default (total 100)
INSERT INTO mata_pelajaran (kode, nama_mapel, kkm)
VALUES ('DEMO-INF', 'Informatika', 75)
ON CONFLICT (kode) DO NOTHING;

INSERT INTO pengampu (mapel_id, kelas_tahun_ajaran_id, guru_id)
SELECT m.id, kta.id, g.id
FROM mata_pelajaran m, kelas_tahun_ajaran kta, kelas k, tahun_ajaran ta, guru g
WHERE m.kode = 'DEMO-INF'
  AND k.id = kta.kelas_id AND k.nama_kelas = 'X TKJ 1'
  AND ta.id = kta.tahun_ajaran_id AND ta.is_active
  AND g.nip = 'DEMO-0003'
ON CONFLICT (mapel_id, kelas_tahun_ajaran_id) DO NOTHING;

INSERT INTO bobot_nilai (pengampu_id, semester)
SELECT p.id, 'ganjil' FROM pengampu p
JOIN mata_pelajaran m ON m.id = p.mapel_id AND m.kode = 'DEMO-INF'
ON CONFLICT (pengampu_id, semester) DO NOTHING;
-- Konversi Nilai Perilaku (A-E) sengaja kosong: diisi guru dari aplikasi.

-- 5. Akun: satu untuk setiap role
--    Aturan: akun hanya boleh dibuat oleh akun Tata Usaha (kolom dibuat_oleh,
--    dijaga trigger trg_users_dibuat_tu). Jadi akun TU dibuat dulu, lalu akun
--    lain dicatat sebagai dibuat oleh tu.demo.

-- 5a. Akun Tata Usaha demo. Pembuatnya = admin TU pertama jika sudah ada
--     (dibuat auth-service dari .env); jika tabel users masih kosong, NULL.
INSERT INTO users (username, nama_lengkap, email, password_hash, role_id, guru_id,
                   dibuat_oleh, harus_ganti_password, password_updated_at)
SELECT a.username, a.nama, a.username || '@demo.local', a.hash, r.id, g.id,
       (SELECT u.id FROM users u JOIN roles rr ON rr.id = u.role_id
        WHERE rr.nama = 'tata-usaha' AND u.is_aktif ORDER BY u.created_at LIMIT 1), FALSE, NOW()
FROM (VALUES
    ('tu.demo', 'Staf Tata Usaha', 'tata-usaha', NULL,
     'scrypt$16384$8$1$MasV1+wmdA9b99JVKzN3Xg==$6B4V73X/9yJECrbJkNTwQJhhvarGQc2DAAWpJhHNAyI=')
) AS a(username, nama, role, nip, hash)
JOIN roles r ON r.nama = a.role
LEFT JOIN guru g ON g.nip = a.nip
ON CONFLICT DO NOTHING;

-- 5b. Akun role lain, dibuat oleh tu.demo
INSERT INTO users (username, nama_lengkap, email, password_hash, role_id, guru_id,
                   dibuat_oleh, harus_ganti_password, password_updated_at)
SELECT a.username, a.nama, a.username || '@demo.local', a.hash, r.id, g.id,
       (SELECT id FROM users WHERE username = 'tu.demo'), FALSE, NOW()
FROM (VALUES
    ('kepsek.demo', 'Mangatas Simanjuntak', 'kepala-sekolah', 'DEMO-0001',
     'scrypt$16384$8$1$ioZ4SpoooUtOcqKeIFh0Hg==$YsWJ6+g9hQBuYon60LSEjPU7k4I1WBevQeUQUKOic78='),
    ('waka.demo', 'Rosmaida Sitorus', 'waka-sekolah', 'DEMO-0002',
     'scrypt$16384$8$1$L2NViH0QHtgegVT0NIp39w==$KQKMIR3rd2DEFMasptPMUMe3KO19WRnGJYKoQel30AM='),
    ('guru.demo', 'Hotman Pardede', 'guru-mapel', 'DEMO-0003',
     'scrypt$16384$8$1$qW9fh25rBVAunbIIk2St7w==$g6orlulI8+y6LYnJiY8DlHFSyyDi8tChLHEu8UmlYwI='),
    ('walikelas.demo', 'Hotman Pardede', 'wali-kelas', 'DEMO-0003',
     'scrypt$16384$8$1$Skch3NtAFYkXaf59Ylw00w==$SCe0M16rH1YpScvam2OmuhepJNXOh0rH4myjv4KuqTQ='),
    ('bk.demo', 'Lestari Hutapea', 'bk', 'DEMO-0004',
     'scrypt$16384$8$1$rIb6nu5zT4TlhLOZtrwCuQ==$6jULHqqUBTUUQ4eSnybGKC5t60p9cQSTm2ibM/XjXLM='),
    ('pramuka.demo', 'Benny Silaban', 'pramuka', 'DEMO-0005',
     'scrypt$16384$8$1$2F8dRXzESUpw90MxRf8gMw==$jkGzJsfCpj45klS8iDGDW7ogm7L6S37ZX7ZcOFqDZ5A='),
    ('vokasi.demo', 'Juniar Manurung', 'vokasi', 'DEMO-0006',
     'scrypt$16384$8$1$d0LWxmzC70pa46gMLJOgiw==$45MTHOssQWpO/mWgDgMBlFvMxFdNvpvFJHaG6k6/GQw=')
) AS a(username, nama, role, nip, hash)
JOIN roles r ON r.nama = a.role
LEFT JOIN guru g ON g.nip = a.nip
ON CONFLICT DO NOTHING;

SELECT 'Selesai: ' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') || ' tabel, ' || (SELECT count(*) FROM users) || ' akun' AS hasil;
