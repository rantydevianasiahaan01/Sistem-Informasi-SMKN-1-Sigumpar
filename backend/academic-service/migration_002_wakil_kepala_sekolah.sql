-- =========================================================
-- MIGRATION: tabel milik Wakil Kepala Sekolah
-- Tiga halaman waka (Supervisi, Program Kerja, Pengecekan Perangkat)
-- sebelumnya memanggil endpoint yang tabelnya belum pernah dibuat.
-- Semua tabel membawa tahun_ajaran_id supaya bisa difilter per tahun.
-- =========================================================

CREATE TABLE IF NOT EXISTS supervisi_guru (
    id SERIAL PRIMARY KEY,
    guru_id INTEGER REFERENCES guru(id) ON DELETE SET NULL,
    tanggal DATE NOT NULL,
    kelas VARCHAR(100),
    mata_pelajaran VARCHAR(150),
    aspek_penilaian VARCHAR(150),
    nilai NUMERIC(5,2),
    catatan TEXT,
    rekomendasi TEXT,
    tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_supervisi_guru_guru_id ON supervisi_guru(guru_id);
CREATE INDEX IF NOT EXISTS idx_supervisi_guru_tanggal ON supervisi_guru(tanggal);
CREATE INDEX IF NOT EXISTS idx_supervisi_guru_tahun_ajaran_id ON supervisi_guru(tahun_ajaran_id);

CREATE TABLE IF NOT EXISTS program_kerja (
    id SERIAL PRIMARY KEY,
    nama_program VARCHAR(200) NOT NULL,
    bidang VARCHAR(100),
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    penanggung_jawab VARCHAR(150),
    -- belum_mulai | sedang_berjalan | selesai
    status VARCHAR(30) NOT NULL DEFAULT 'belum_mulai',
    deskripsi TEXT,
    tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_program_kerja_status ON program_kerja(status);
CREATE INDEX IF NOT EXISTS idx_program_kerja_tahun_ajaran_id ON program_kerja(tahun_ajaran_id);

-- Daftar perangkat yang wajib dimiliki tiap guru, dicatat oleh waka.
-- Berbeda dengan perangkat_pembelajaran milik learning-service yang berisi
-- dokumen unggahan guru beserta review kepsek.
CREATE TABLE IF NOT EXISTS perangkat_guru (
    id SERIAL PRIMARY KEY,
    guru_id INTEGER NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
    nama_perangkat VARCHAR(200) NOT NULL,
    jenis VARCHAR(100),
    -- lengkap | belum_lengkap
    status VARCHAR(30) NOT NULL DEFAULT 'belum_lengkap',
    catatan TEXT,
    tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_perangkat_guru_guru_id ON perangkat_guru(guru_id);
CREATE INDEX IF NOT EXISTS idx_perangkat_guru_tahun_ajaran_id ON perangkat_guru(tahun_ajaran_id);

-- Data lama (kalau tabelnya sudah terlanjur ada tanpa kolom tahun ajaran)
ALTER TABLE supervisi_guru ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER;
ALTER TABLE program_kerja ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER;
ALTER TABLE perangkat_guru ADD COLUMN IF NOT EXISTS tahun_ajaran_id INTEGER;
