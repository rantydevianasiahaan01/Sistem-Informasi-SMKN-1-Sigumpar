-- Simpan berkas di folder uploads; kolom file_path menunjuk nama file di disk.
ALTER TABLE perangkat_pembelajaran
  ADD COLUMN IF NOT EXISTS file_path VARCHAR(255);
