-- Progres & Nilai UKK.
-- Kedua tabel belum pernah dibuat di container lama. Nilai UKK juga berpindah
-- dari (praktik, teori) ke (praktik, sikap) dengan bobot yang diatur user.

CREATE TABLE IF NOT EXISTS progres_ukk (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL,
    siswa_id INTEGER NOT NULL,
    nama_siswa VARCHAR(150),
    nama_kelas VARCHAR(100),
    tahap VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    link_bukti TEXT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE progres_ukk ADD COLUMN IF NOT EXISTS nama_siswa VARCHAR(150);
ALTER TABLE progres_ukk ADD COLUMN IF NOT EXISTS nama_kelas VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_progres_ukk_kelas_id ON progres_ukk(kelas_id);
CREATE INDEX IF NOT EXISTS idx_progres_ukk_siswa_id ON progres_ukk(siswa_id);

CREATE TABLE IF NOT EXISTS nilai_ukk (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL,
    siswa_id INTEGER NOT NULL,
    nama_siswa VARCHAR(150),
    nama_kelas VARCHAR(100),
    nilai_praktik NUMERIC(5,2) DEFAULT 0,
    nilai_sikap NUMERIC(5,2) DEFAULT 0,
    bobot_praktik NUMERIC(5,2) DEFAULT 70,
    bobot_sikap NUMERIC(5,2) DEFAULT 30,
    nilai_akhir NUMERIC(5,2) DEFAULT 0,
    catatan_penguji TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- kolom baru untuk tabel yang mungkin sudah terlanjur dibuat versi lama
ALTER TABLE nilai_ukk ADD COLUMN IF NOT EXISTS nama_siswa VARCHAR(150);
ALTER TABLE nilai_ukk ADD COLUMN IF NOT EXISTS nama_kelas VARCHAR(100);
ALTER TABLE nilai_ukk ADD COLUMN IF NOT EXISTS nilai_sikap NUMERIC(5,2) DEFAULT 0;
ALTER TABLE nilai_ukk ADD COLUMN IF NOT EXISTS bobot_praktik NUMERIC(5,2) DEFAULT 70;
ALTER TABLE nilai_ukk ADD COLUMN IF NOT EXISTS bobot_sikap NUMERIC(5,2) DEFAULT 30;

-- satu baris nilai per siswa per kelas, supaya input ulang menimpa bukan menduplikasi
CREATE UNIQUE INDEX IF NOT EXISTS idx_nilai_ukk_siswa_kelas
ON nilai_ukk (siswa_id, kelas_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;
