-- =====================================================
-- INIT DATABASE VOCATIONAL SERVICE
-- =====================================================

-- =====================================================
-- 1. TABEL REGU PRAMUKA
-- =====================================================

CREATE TABLE IF NOT EXISTS kelas_pramuka (
    id SERIAL PRIMARY KEY,
    nama_regu VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS anggota_regu (
    id SERIAL PRIMARY KEY,
    regu_id INTEGER REFERENCES kelas_pramuka(id) ON DELETE CASCADE,
    siswa_id INTEGER NOT NULL,
    nama_lengkap VARCHAR(150)
);

-- =====================================================
-- 2. ABSENSI PRAMUKA
-- =====================================================

CREATE TABLE IF NOT EXISTS absensi_pramuka (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER NOT NULL,
    siswa_id INTEGER NOT NULL,
    nama_lengkap VARCHAR(150),
    nisn VARCHAR(30),
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpa')),
    keterangan TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_absensi_pramuka_kelas_siswa_tanggal
ON absensi_pramuka (kelas_id, siswa_id, tanggal);

CREATE INDEX IF NOT EXISTS idx_absensi_pramuka_kelas_id
ON absensi_pramuka(kelas_id);

CREATE INDEX IF NOT EXISTS idx_absensi_pramuka_siswa_id
ON absensi_pramuka(siswa_id);

CREATE INDEX IF NOT EXISTS idx_absensi_pramuka_tanggal
ON absensi_pramuka(tanggal);

-- =====================================================
-- 3. LAPORAN PRAMUKA / LOG ABSENSI KEGIATAN
-- =====================================================

CREATE TABLE IF NOT EXISTS laporan_pramuka (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER,
    tanggal DATE DEFAULT CURRENT_DATE,
    judul VARCHAR(150),
    deskripsi TEXT,
    file_url TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. SILABUS / PERANGKAT KEGIATAN PRAMUKA
-- =====================================================

CREATE TABLE IF NOT EXISTS silabus_pramuka (
    id SERIAL PRIMARY KEY,
    kelas_id INTEGER,
    nama_kelas VARCHAR(100),
    judul_kegiatan VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    file_path VARCHAR(255),
    file_data BYTEA,
    file_mime VARCHAR(100),
    file_nama VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_silabus_pramuka_kelas_id
ON silabus_pramuka(kelas_id);

-- =====================================================
-- 5. LAPORAN KEGIATAN PRAMUKA
-- =====================================================

CREATE TABLE IF NOT EXISTS laporan_kegiatan (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    file_path VARCHAR(255),
    file_data BYTEA,
    file_mime VARCHAR(100),
    file_nama VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laporan_kegiatan_tanggal
ON laporan_kegiatan(tanggal);

-- =====================================================
-- 6. PKL: LOKASI
-- =====================================================

CREATE TABLE IF NOT EXISTS laporan_lokasi_pkl (
    id SERIAL PRIMARY KEY,
    siswa_id TEXT,
    kelas_id INTEGER,
    nama_kelas VARCHAR(100),
    nama_siswa VARCHAR(150),
    nisn VARCHAR(30),
    nama_perusahaan VARCHAR(150),
    alamat TEXT,
    posisi VARCHAR(150),
    deskripsi_pekerjaan TEXT,
    pembimbing_industri VARCHAR(150),
    kontak_pembimbing VARCHAR(100),
    tanggal DATE DEFAULT CURRENT_DATE,
    tanggal_selesai DATE,
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laporan_lokasi_pkl_kelas_id
ON laporan_lokasi_pkl(kelas_id);

CREATE INDEX IF NOT EXISTS idx_laporan_lokasi_pkl_siswa_id
ON laporan_lokasi_pkl(siswa_id);

-- =====================================================
-- 7. PKL: PROGRES
-- =====================================================

CREATE TABLE IF NOT EXISTS laporan_progres_pkl (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    kelas_id INTEGER,
    nama_siswa VARCHAR(150),
    nisn VARCHAR(30),
    minggu_ke INTEGER NOT NULL,
    deskripsi TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_laporan_progres_pkl_siswa_id
ON laporan_progres_pkl(siswa_id);

-- =====================================================
-- 8. PKL: NILAI
-- =====================================================

CREATE TABLE IF NOT EXISTS nilai_pkl (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER NOT NULL,
    kelas_id INTEGER NOT NULL,

    nama_siswa VARCHAR(150),
    nisn VARCHAR(30),

    nilai_praktik NUMERIC(5,2) DEFAULT 0,
    nilai_sikap NUMERIC(5,2) DEFAULT 0,
    nilai_laporan NUMERIC(5,2) DEFAULT 0,

    nilai_akhir NUMERIC(5,2) DEFAULT 0,
    predikat VARCHAR(30),
    catatan TEXT,

    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_nilai_pkl UNIQUE (siswa_id, kelas_id)
);

CREATE INDEX IF NOT EXISTS idx_nilai_pkl_kelas_id
ON nilai_pkl(kelas_id);

CREATE INDEX IF NOT EXISTS idx_nilai_pkl_siswa_id
ON nilai_pkl(siswa_id);

-- =====================================================
-- 9. UKK: PROGRES, NILAI, SOAL
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_progres_ukk_kelas_id ON progres_ukk(kelas_id);
CREATE INDEX IF NOT EXISTS idx_progres_ukk_siswa_id ON progres_ukk(siswa_id);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_nilai_ukk_siswa_kelas
ON nilai_ukk (siswa_id, kelas_id);

CREATE TABLE IF NOT EXISTS soal_ukk (
    id SERIAL PRIMARY KEY,
    jurusan VARCHAR(255) NOT NULL,
    judul_tugas VARCHAR(255) NOT NULL,
    instruksi TEXT NOT NULL,
    lampiran TEXT,
    tahun_ajaran VARCHAR(50),
    file_path VARCHAR(255),
    file_data BYTEA,
    file_mime VARCHAR(100),
    file_nama VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS kelas_id INTEGER;
ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS nama_kelas VARCHAR(100);

-- =====================================================
-- 9b. SERTIFIKAT UKK
-- =====================================================

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
    file_path VARCHAR(255),
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

-- =====================================================
-- 10. AUTO UPDATE updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_absensi_pramuka ON absensi_pramuka;
CREATE TRIGGER set_updated_at_absensi_pramuka
BEFORE UPDATE ON absensi_pramuka
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_laporan_pramuka ON laporan_pramuka;
CREATE TRIGGER set_updated_at_laporan_pramuka
BEFORE UPDATE ON laporan_pramuka
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_silabus ON silabus_pramuka;
CREATE TRIGGER set_updated_at_silabus
BEFORE UPDATE ON silabus_pramuka
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_laporan ON laporan_kegiatan;
CREATE TRIGGER set_updated_at_laporan
BEFORE UPDATE ON laporan_kegiatan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_lokasi_pkl ON laporan_lokasi_pkl;
CREATE TRIGGER set_updated_at_lokasi_pkl
BEFORE UPDATE ON laporan_lokasi_pkl
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_progres_pkl ON laporan_progres_pkl;
CREATE TRIGGER set_updated_at_progres_pkl
BEFORE UPDATE ON laporan_progres_pkl
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_nilai_pkl ON nilai_pkl;
CREATE TRIGGER set_updated_at_nilai_pkl
BEFORE UPDATE ON nilai_pkl
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_progres_ukk ON progres_ukk;
CREATE TRIGGER set_updated_at_progres_ukk
BEFORE UPDATE ON progres_ukk
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_nilai_ukk ON nilai_ukk;
CREATE TRIGGER set_updated_at_nilai_ukk
BEFORE UPDATE ON nilai_ukk
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_soal_ukk ON soal_ukk;
CREATE TRIGGER set_updated_at_soal_ukk
BEFORE UPDATE ON soal_ukk
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. PRIVILEGES
-- =====================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vocational_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vocational_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO vocational_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO vocational_user;