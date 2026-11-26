-- =========================================================
-- MIGRATION: isi tahun_ajaran_id untuk data lama
-- absensi_siswa dicocokkan lewat rentang tanggal tahun ajaran,
-- nilai_siswa lewat label tahun_ajar yang sudah tersimpan.
-- Dilewati kalau tabel tahun_ajaran belum dibuat academic-service.
-- =========================================================

DO $$
BEGIN
  IF to_regclass('public.tahun_ajaran') IS NULL THEN
    RAISE NOTICE 'Tabel tahun_ajaran belum ada, backfill dilewati';
    RETURN;
  END IF;

  UPDATE absensi_siswa a
  SET tahun_ajaran_id = ta.id
  FROM tahun_ajaran ta
  WHERE a.tahun_ajaran_id IS NULL
    AND ta.tanggal_mulai IS NOT NULL
    AND ta.tanggal_selesai IS NOT NULL
    AND a.tanggal BETWEEN ta.tanggal_mulai AND ta.tanggal_selesai;

  -- Sisanya (di luar rentang tahun mana pun) diikutkan ke tahun aktif supaya
  -- tidak ada baris yang hilang dari semua filter.
  UPDATE absensi_siswa
  SET tahun_ajaran_id = (
    SELECT id FROM tahun_ajaran WHERE is_active = true LIMIT 1
  )
  WHERE tahun_ajaran_id IS NULL;

  UPDATE nilai_siswa n
  SET tahun_ajaran_id = ta.id
  FROM tahun_ajaran ta
  WHERE n.tahun_ajaran_id IS NULL
    AND n.tahun_ajar = ta.label;
END $$;
