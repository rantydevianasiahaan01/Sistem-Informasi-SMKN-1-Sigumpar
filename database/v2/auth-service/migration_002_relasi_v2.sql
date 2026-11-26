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
