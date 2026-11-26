-- =========================================================
-- MIGRATION: Tahun Ajaran (Academic Year)
-- Scope:
-- 1. tahun_ajaran (master)
-- 2. kelas_tahun_ajaran (rombel per tahun ajaran)
-- 3. siswa_kelas_tahun_ajaran (histori penempatan siswa / kenaikan kelas)
-- 4. Backfill data lama ke tahun ajaran default 2026/2027
-- =========================================================

CREATE TABLE IF NOT EXISTS tahun_ajaran (
    id SERIAL PRIMARY KEY,
    label VARCHAR(20) NOT NULL UNIQUE,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tahun_ajaran_single_active
    ON tahun_ajaran (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS kelas_tahun_ajaran (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE RESTRICT,
    wali_kelas_id UUID,
    wali_kelas_nama VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_kelas_per_tahun UNIQUE (kelas_id, tahun_ajaran_id)
);
CREATE INDEX IF NOT EXISTS idx_kta_kelas_id ON kelas_tahun_ajaran(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kta_tahun_ajaran_id ON kelas_tahun_ajaran(tahun_ajaran_id);

CREATE TABLE IF NOT EXISTS siswa_kelas_tahun_ajaran (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    kelas_tahun_ajaran_id INTEGER NOT NULL REFERENCES kelas_tahun_ajaran(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_siswa_per_kelas_tahun UNIQUE (siswa_id, kelas_tahun_ajaran_id)
);
CREATE INDEX IF NOT EXISTS idx_skta_siswa_id ON siswa_kelas_tahun_ajaran(siswa_id);
CREATE INDEX IF NOT EXISTS idx_skta_kta_id ON siswa_kelas_tahun_ajaran(kelas_tahun_ajaran_id);

-- --- Backfill data lama ---

-- 1. Seed tahun ajaran default & aktifkan
INSERT INTO tahun_ajaran (label, tanggal_mulai, tanggal_selesai, is_active)
SELECT '2026/2027', '2026-07-01', '2027-06-30', true
WHERE NOT EXISTS (SELECT 1 FROM tahun_ajaran);

-- 2. Buka semua kelas existing di tahun itu, bawa wali_kelas_id/nama yang sudah ada
INSERT INTO kelas_tahun_ajaran (kelas_id, tahun_ajaran_id, wali_kelas_id, wali_kelas_nama)
SELECT k.id, ta.id, k.wali_kelas_id, k.wali_kelas_nama
FROM kelas k
CROSS JOIN (SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1) ta
WHERE NOT EXISTS (
  SELECT 1 FROM kelas_tahun_ajaran kta WHERE kta.kelas_id = k.id AND kta.tahun_ajaran_id = ta.id
);

-- 3. Tempatkan semua siswa existing (berdasarkan kelas_id saat ini) ke rombel yang baru dibuat
INSERT INTO siswa_kelas_tahun_ajaran (siswa_id, kelas_tahun_ajaran_id, status)
SELECT s.id, kta.id, 'aktif'
FROM siswa s
JOIN kelas_tahun_ajaran kta ON kta.kelas_id = s.kelas_id
JOIN tahun_ajaran ta ON ta.id = kta.tahun_ajaran_id AND ta.is_active = true
WHERE s.kelas_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM siswa_kelas_tahun_ajaran skta WHERE skta.siswa_id = s.id AND skta.kelas_tahun_ajaran_id = kta.id
  );

-- Jadwal piket ikut tahun ajaran (reference sederhana, tanpa tabel penghubung
-- karena piket per-orang per-tanggal, tidak terikat kelas seperti siswa/nilai).
ALTER TABLE jadwal_piket ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);
CREATE INDEX IF NOT EXISTS idx_jadwal_piket_tahun_ajaran_id ON jadwal_piket(tahun_ajaran_id);

-- Backfill piket lama ke tahun ajaran default yang baru di-seed
UPDATE jadwal_piket
SET tahun_ajaran_id = (SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1)
WHERE tahun_ajaran_id IS NULL;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO academic_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO academic_user;
