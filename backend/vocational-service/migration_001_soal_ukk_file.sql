-- Bank soal UKK.
-- Container lama dibuat sebelum tabel ini ada di init.sql, jadi tabelnya
-- dibuat di sini sekaligus ditambah kolom dokumen pendukung (PDF/DOC/DOCX).

CREATE TABLE IF NOT EXISTS soal_ukk (
    id SERIAL PRIMARY KEY,
    jurusan VARCHAR(255) NOT NULL,
    judul_tugas VARCHAR(255) NOT NULL,
    instruksi TEXT NOT NULL,
    lampiran TEXT,
    tahun_ajaran VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100);
ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS file_nama VARCHAR(255);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;
