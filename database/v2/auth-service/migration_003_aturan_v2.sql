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
