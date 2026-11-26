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
