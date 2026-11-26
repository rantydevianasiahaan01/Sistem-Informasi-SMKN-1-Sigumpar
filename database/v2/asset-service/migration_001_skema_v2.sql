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
