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
