-- =====================================================================
-- Migration 004 academic-service: data orang tua siswa (Sprint 4, task #2)
-- Dibutuhkan modul BK (pemanggilan, pendampingan, pengembalian siswa).
-- Acuan     : database/v2 tabel `orang_tua`.
-- Perbedaan : `hubungan` memakai CHECK, bukan ENUM (mengikuti gaya tabel
--             existing dan aman untuk migration yang dijalankan ulang);
--             ditambah created_at/updated_at seperti tabel existing lain.
-- Idempoten : aman dijalankan ulang setiap container start.
-- =====================================================================

CREATE TABLE IF NOT EXISTS orang_tua (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    nama VARCHAR(150) NOT NULL,
    hubungan VARCHAR(10) NOT NULL CHECK (hubungan IN ('ayah', 'ibu', 'wali')),
    no_hp VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orang_tua_siswa_id ON orang_tua(siswa_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO academic_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO academic_user;
