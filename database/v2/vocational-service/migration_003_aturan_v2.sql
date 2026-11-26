-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : vocational-service (Pramuka, PKL, UKK)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE pengaturan_pkl ADD CONSTRAINT ck_pengaturan_pkl_total
  CHECK (bobot_praktik + bobot_sikap + bobot_laporan = 100);

ALTER TABLE pengaturan_ukk ADD CONSTRAINT ck_pengaturan_ukk_total
  CHECK (bobot_praktik + bobot_sikap = 100);

-- Perpindahan PKL: lokasi asal dan tujuan tidak boleh sama
ALTER TABLE perpindahan_pkl ADD CONSTRAINT ck_perpindahan_beda_lokasi
  CHECK (penempatan_asal_id <> penempatan_tujuan_id);

-- Perpindahan PKL: permanen, perbaikan lewat koreksi_perpindahan
DROP TRIGGER IF EXISTS trg_perpindahan_pkl_permanen ON perpindahan_pkl;

CREATE TRIGGER trg_perpindahan_pkl_permanen
  BEFORE UPDATE OR DELETE ON perpindahan_pkl
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_data();

-- 4b. Nilai akhir PKL (ambang predikat = asumsi, sesuaikan dengan aturan sekolah)
CREATE OR REPLACE VIEW v_nilai_pkl AS
SELECT n.*,
  ROUND((n.nilai_praktik * p.bobot_praktik
       + n.nilai_sikap   * p.bobot_sikap
       + n.nilai_laporan * p.bobot_laporan) / 100, 2) AS nilai_akhir,
  CASE
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 90 THEN 'A'
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 80 THEN 'B'
    WHEN (n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap
          + n.nilai_laporan * p.bobot_laporan) / 100 >= 70 THEN 'C'
    ELSE 'D'
  END AS predikat
FROM nilai_pkl n
JOIN pengaturan_pkl p ON p.tahun_ajaran_id = n.tahun_ajaran_id;

-- 4c. Nilai akhir UKK (bobot dari pengaturan_ukk tahun ajaran rombel soal)
CREATE OR REPLACE VIEW v_nilai_ukk AS
SELECT n.*,
  ROUND((n.nilai_praktik * p.bobot_praktik + n.nilai_sikap * p.bobot_sikap) / 100, 2) AS nilai_akhir
FROM nilai_ukk n
JOIN soal_ukk s            ON s.id = n.soal_id
JOIN kelas_tahun_ajaran kt ON kt.id = s.kelas_tahun_ajaran_id
JOIN pengaturan_ukk p      ON p.tahun_ajaran_id = kt.tahun_ajaran_id;
