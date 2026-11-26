-- =========================================================
-- MIGRATION: Bobot nilai UKK pindah dari localStorage ke database
-- Sebelumnya bobot praktik/sikap disimpan di browser masing-masing
-- penguji, jadi tiap perangkat bisa memakai bobot berbeda.
-- Tabel ini hanya berisi satu baris (id = 1) sebagai pengaturan sekolah.
-- =========================================================

CREATE TABLE IF NOT EXISTS pengaturan_ukk (
    id INTEGER PRIMARY KEY,
    bobot_praktik NUMERIC(5,2) NOT NULL DEFAULT 70,
    bobot_sikap NUMERIC(5,2) NOT NULL DEFAULT 30,
    updated_by UUID,
    updated_by_nama VARCHAR(150),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pengaturan_ukk_baris_tunggal CHECK (id = 1),
    CONSTRAINT pengaturan_ukk_total_100 CHECK (bobot_praktik + bobot_sikap = 100)
);

INSERT INTO pengaturan_ukk (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;
