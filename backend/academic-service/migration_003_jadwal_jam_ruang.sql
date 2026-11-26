-- =========================================================
-- MIGRATION: Jam ke- dan ruang pada jadwal mengajar
-- Scope:
-- 1. Kolom jam_ke dan ruang
-- 2. Index pendukung pengecekan bentrok (hari + waktu)
-- Deteksi bentrok guru/kelas/ruang dilakukan di jadwalController,
-- bukan sebagai constraint, karena rentang waktu bisa saling tumpang
-- tindih sebagian dan pesan errornya perlu menyebut jadwal lawannya.
-- =========================================================

ALTER TABLE jadwal_mengajar ADD COLUMN IF NOT EXISTS jam_ke INTEGER;
ALTER TABLE jadwal_mengajar ADD COLUMN IF NOT EXISTS ruang VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_jadwal_hari_waktu
    ON jadwal_mengajar (hari, waktu_mulai, waktu_berakhir);
