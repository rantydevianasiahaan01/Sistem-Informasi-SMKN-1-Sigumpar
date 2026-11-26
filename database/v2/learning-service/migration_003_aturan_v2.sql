-- =====================================================================
-- MIGRATION 003: Aturan bisnis (CHECK, indeks khusus, trigger, view)
-- Service : learning-service (absensi guru, perangkat pembelajaran, evaluasi guru)
-- Sumber  : PDM v2 (pdm_smkn1_sigumpar_pg.dbml)
-- Urutan  : lihat database/v2/README.md (jalankan_semua.sh)
-- Dijalankan setelah 002 semua service.
-- =====================================================================

ALTER TABLE evaluasi_guru ADD CONSTRAINT ck_evaluasi_rentang CHECK (
  (perencanaan  IS NULL OR perencanaan  BETWEEN 0 AND 100) AND
  (pelaksanaan  IS NULL OR pelaksanaan  BETWEEN 0 AND 100) AND
  (penilaian    IS NULL OR penilaian    BETWEEN 0 AND 100) AND
  (pengembangan IS NULL OR pengembangan BETWEEN 0 AND 100) AND
  (kedisiplinan IS NULL OR kedisiplinan BETWEEN 0 AND 100)
);

-- 4d. Skor evaluasi kinerja guru (bobot 20/30/20/15/15 sesuai user manual)
CREATE OR REPLACE VIEW v_evaluasi_guru AS
SELECT e.*,
  ROUND(e.perencanaan * 0.20 + e.pelaksanaan * 0.30 + e.penilaian * 0.20
      + e.pengembangan * 0.15 + e.kedisiplinan * 0.15, 2) AS skor
FROM evaluasi_guru e;

-- 4e. Status review terkini perangkat pembelajaran
CREATE OR REPLACE VIEW v_status_perangkat AS
SELECT p.*,
  COALESCE(r.status::text, 'menunggu') AS status_review,
  r.komentar        AS catatan_review,
  r.peran_reviewer  AS direview_oleh_peran,
  r.created_at      AS direview_pada
FROM perangkat_pembelajaran p
LEFT JOIN LATERAL (
  SELECT * FROM review_perangkat rp
  WHERE rp.perangkat_id = p.id
  ORDER BY rp.created_at DESC
  LIMIT 1
) r ON true;
