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
