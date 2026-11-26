-- Simpan berkas di folder uploads; file_path = nama file di disk.
ALTER TABLE soal_ukk ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);
ALTER TABLE sertifikat_ukk ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);
ALTER TABLE silabus_pramuka ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);
ALTER TABLE laporan_kegiatan ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);
