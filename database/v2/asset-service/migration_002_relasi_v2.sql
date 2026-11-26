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
