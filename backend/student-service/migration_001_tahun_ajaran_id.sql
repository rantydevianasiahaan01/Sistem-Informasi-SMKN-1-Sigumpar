-- =========================================================
-- MIGRATION: tahun_ajaran_id reference (ke academic-service.tahun_ajaran)
-- Tidak ada FK constraint asli karena beda database/service.
-- Kolom tahun_ajar (string) tetap dipertahankan sebagai label snapshot legacy.
-- =========================================================

ALTER TABLE nilai_siswa ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_nilai_siswa_tahun_ajaran_id ON nilai_siswa(tahun_ajaran_id);

ALTER TABLE absensi_siswa ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tahun_ajaran_id ON absensi_siswa(tahun_ajaran_id);
