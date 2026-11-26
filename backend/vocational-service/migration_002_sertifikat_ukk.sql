-- Sertifikat UKK: arsip sertifikat hasil Uji Kompetensi Keahlian per siswa,
-- lengkap dengan berkas sertifikatnya (PDF/gambar/DOC).

CREATE TABLE IF NOT EXISTS sertifikat_ukk (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    nama_siswa VARCHAR(150),
    kelas_id INTEGER,
    nama_kelas VARCHAR(100),
    nomor_sertifikat VARCHAR(100),
    tanggal_terbit DATE,
    predikat VARCHAR(50),
    catatan TEXT,
    file_data BYTEA,
    file_mime VARCHAR(100),
    file_nama VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sertifikat_ukk_siswa_id
ON sertifikat_ukk(siswa_id);

CREATE INDEX IF NOT EXISTS idx_sertifikat_ukk_kelas_id
ON sertifikat_ukk(kelas_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;
